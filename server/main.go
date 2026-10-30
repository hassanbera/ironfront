package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type Peer struct {
	conn   *websocket.Conn
	out    chan []byte
	owner  int
	room   *Room
	cancel context.CancelFunc
}
type Room struct {
	mu         sync.Mutex
	game       *Game
	peers      map[int]*Peer
	lastActive time.Time
}
type Server struct {
	mu       sync.Mutex
	rooms    map[string]*Room
	origins  []string
	maxRooms int
}

func newServer(origins []string) *Server {
	return &Server{rooms: map[string]*Room{}, origins: origins, maxRooms: 128}
}
func randomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func (s *Server) join(c Command, p *Peer) (map[string]any, error) {
	if c.Type != "join" && c.Type != "create" {
		return nil, fmt.Errorf("Önce bir odaya katıl")
	}
	if c.Faction < 0 || c.Faction > 3 || c.HeroClass < 0 || c.HeroClass > 2 {
		return nil, fmt.Errorf("Geçersiz faction veya hero sınıfı")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	var r *Room
	code := strings.ToUpper(strings.TrimSpace(c.Room))
	if c.Type == "create" {
		if len(s.rooms) >= s.maxRooms {
			return nil, fmt.Errorf("Sunucu dolu")
		}
		for {
			code = strings.ToUpper(randomToken(3))
			if s.rooms[code] == nil {
				break
			}
		}
		r = &Room{game: NewGame(code, c.Map, c.Faction), peers: map[int]*Peer{}, lastActive: time.Now()}
		s.rooms[code] = r
	} else {
		r = s.rooms[code]
		if r == nil {
			return nil, fmt.Errorf("Oda bulunamadı. Altı haneli kodu kontrol et")
		}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	owner := -1
	for _, player := range r.game.Players {
		if player != nil && c.Token != "" && player.Token == c.Token {
			owner = player.ID
			break
		}
	}
	if owner < 0 {
		if r.game.Phase != "lobby" {
			return nil, fmt.Errorf("Bu savaş başladı. Yalnızca mevcut oyuncular yeniden bağlanabilir")
		}
		owner = c.Faction
		if r.game.Players[owner] != nil {
			return nil, fmt.Errorf("Bu faction seçilmiş. Başka bir sancak seç")
		}
		name := strings.TrimSpace(c.Name)
		if name == "" {
			name = "Komutan"
		}
		if utf8.RuneCountInString(name) > 20 {
			name = string([]rune(name)[:20])
		}
		r.game.Players[owner] = &Player{ID: owner, Name: name, Faction: owner, HeroClass: c.HeroClass, Token: randomToken(24), MainBase: owner}
	}
	player := r.game.Players[owner]
	player.Connected = true
	player.Bot = false
	if old := r.peers[owner]; old != nil {
		old.cancel()
	}
	p.owner = owner
	p.room = r
	r.peers[owner] = p
	r.lastActive = time.Now()
	if c.Type == "create" && c.Practice {
		if err := r.game.start(true); err != nil {
			return nil, err
		}
	}
	return map[string]any{"type": "welcome", "room": code, "owner": owner, "token": player.Token}, nil
}
func (s *Server) serveWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: s.origins, CompressionMode: websocket.CompressionDisabled})
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(4096)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	p := &Peer{conn: conn, out: make(chan []byte, 3), cancel: cancel}
	joinCtx, stop := context.WithTimeout(ctx, 8*time.Second)
	var cmd Command
	err = wsjson.Read(joinCtx, conn, &cmd)
	stop()
	if err != nil {
		return
	}
	welcome, err := s.join(cmd, p)
	if err != nil {
		wsjson.Write(ctx, conn, map[string]string{"type": "error", "message": err.Error()})
		conn.Close(websocket.StatusPolicyViolation, "join rejected")
		return
	}
	defer func() {
		p.room.mu.Lock()
		defer p.room.mu.Unlock()
		if p.room.peers[p.owner] == p {
			delete(p.room.peers, p.owner)
			player := p.room.game.Players[p.owner]
			if player != nil {
				player.Connected = false
				player.LastSeen = p.room.game.Time
			}
			if h := p.room.game.hero(p.owner); h != nil {
				h.Input = HeroInput{}
				h.Active = false
			}
			p.room.lastActive = time.Now()
		}
	}()
	if err := wsjson.Write(ctx, conn, welcome); err != nil {
		return
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			select {
			case <-ctx.Done():
				return
			case data := <-p.out:
				writeCtx, stop := context.WithTimeout(ctx, 2*time.Second)
				err := conn.Write(writeCtx, websocket.MessageText, data)
				stop()
				if err != nil {
					cancel()
					return
				}
			}
		}
	}()
	defer func() { cancel(); <-done }()
	tokens := 80.0
	last := time.Now()
	for {
		var c Command
		if err := wsjson.Read(ctx, conn, &c); err != nil {
			return
		}
		now := time.Now()
		tokens = clamp(tokens+now.Sub(last).Seconds()*45, 0, 80)
		last = now
		if tokens < 1 {
			conn.Close(websocket.StatusPolicyViolation, "command rate exceeded")
			return
		}
		tokens--
		if c.Type == "ping" {
			data, _ := json.Marshal(map[string]any{"type": "pong", "stamp": c.Stamp})
			queue(p, data)
			continue
		}
		p.room.mu.Lock()
		if c.Type == "leave" {
			g := p.room.game
			if g.Phase == "lobby" {
				g.Players[p.owner] = nil
				if g.Host == p.owner {
					for _, candidate := range g.Players {
						if candidate != nil && candidate.Connected {
							g.Host = candidate.ID
							break
						}
					}
				}
			} else if g.Players[p.owner] != nil {
				g.Players[p.owner].Bot = true
			}
			p.room.mu.Unlock()
			return
		}
		err := p.room.game.command(p.owner, c)
		p.room.mu.Unlock()
		if err != nil {
			data, _ := json.Marshal(map[string]string{"type": "error", "message": err.Error()})
			queue(p, data)
		}
	}
}
func queue(p *Peer, data []byte) {
	select {
	case p.out <- data:
	default:
		select {
		case <-p.out:
		default:
		}
		select {
		case p.out <- data:
		default:
		}
	}
}
func (s *Server) run(ctx context.Context) {
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()
	ticks := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			ticks++
			s.mu.Lock()
			for code, r := range s.rooms {
				r.mu.Lock()
				if len(r.peers) == 0 && time.Since(r.lastActive) > 2*time.Minute {
					delete(s.rooms, code)
					r.mu.Unlock()
					continue
				}
				if len(r.peers) > 0 {
					r.lastActive = time.Now()
				}
				r.game.step(0.05)
				if ticks%2 == 0 {
					data, err := json.Marshal(r.game)
					if err == nil {
						// Coalesce 20 Hz impacts into the same 10 Hz visual snapshot.
						r.game.hitEpoch++
						for _, p := range r.peers {
							queue(p, data)
						}
					}
				}
				r.mu.Unlock()
			}
			s.mu.Unlock()
		}
	}
}
func (s *Server) handler(staticDir string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.serveWS)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		s.mu.Lock()
		count := len(s.rooms)
		s.mu.Unlock()
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "rooms": count, "tickRate": 20})
	})
	if staticDir != "" {
		fs := http.FileServer(http.Dir(staticDir))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			path := filepath.Join(staticDir, filepath.Clean("/"+r.URL.Path))
			if _, err := os.Stat(path); err != nil {
				http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		})
	}
	return mux
}
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}
	origins := []string{"localhost:5173", "127.0.0.1:5173", "localhost:8787", "127.0.0.1:8787"}
	if env := os.Getenv("ALLOWED_ORIGINS"); env != "" {
		origins = strings.Split(env, ",")
	}
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "../frontend/dist"
	}
	s := newServer(origins)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	go s.run(ctx)
	server := &http.Server{Addr: ":" + port, Handler: s.handler(staticDir), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(shutdown)
	}()
	log.Printf("IRONFRONT · http://localhost:%s · 20Hz authoritative simulation", port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
