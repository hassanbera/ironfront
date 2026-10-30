package main

import (
	"math"
	"testing"
)

func battle(t *testing.T, mapID int) *Game {
	t.Helper()
	g := NewGame("TEST01", mapID, 0)
	g.Players[0] = &Player{ID: 0, Faction: 0, MainBase: 0}
	if err := g.start(true); err != nil {
		t.Fatal(err)
	}
	for _, p := range g.Players {
		p.Bot = false
	}
	return g
}
func TestMainBaseSuccession(t *testing.T) {
	g := battle(t, 0)
	g.Bases[3].Owner = 0
	g.updateCapacity()
	if g.Players[0].Capacity != 150 {
		t.Fatal("second base must add 50")
	}
	g.Bases[0].Owner = 1
	g.updateCapacity()
	p := g.Players[0]
	if p.MainBase != 3 || p.Capacity != 100 {
		t.Fatalf("captured Turks base must become main and preserve 100: %+v", p)
	}
	g.Outposts[2].Owner = 0
	g.updateCapacity()
	if p.Capacity != 125 {
		t.Fatalf("outpost must add 25, got %d", p.Capacity)
	}
	g.Bases[3].Stage = "ruined"
	g.Bases[3].Owner = -1
	g.updateCapacity()
	if p.MainBase != -1 || p.Capacity != 25 {
		t.Fatal("ruined bases must not provide capacity")
	}
}
func TestOutpostContestedThenCapture(t *testing.T) {
	g := battle(t, 0)
	a, b := g.Squads[0], g.Squads[4]
	o := g.Outposts[0]
	a.X, a.Z = o.X, o.Z
	b.X, b.Z = o.X+1, o.Z
	for i := 0; i < 220; i++ {
		g.capture(.05)
	}
	if !o.Contested || o.Owner != -1 || o.Progress != 0 {
		t.Fatal("contested capture progressed")
	}
	b.X, b.Z = 70, 70
	for i := 0; i < 181; i++ {
		g.capture(.05)
	}
	if o.Owner != 0 {
		t.Fatal("uncontested capture failed")
	}
}
func TestBaseRequiresCommissioning(t *testing.T) {
	g := battle(t, 0)
	b := g.Bases[3]
	b.Stage = "ruined"
	b.Owner = -1
	b.HP = 0
	for _, s := range g.Squads {
		if s.Owner == 3 {
			s.X, s.Z = 0, 60
		}
	}
	g.hero(3).X, g.hero(3).Z = 0, 60
	g.Squads[0].X, g.Squads[0].Z = b.X, b.Z
	for i := 0; i < 200; i++ {
		g.capture(.05)
	}
	if b.Stage == "active" {
		t.Fatal("base commissioned before 14 seconds")
	}
	for i := 0; i < 81; i++ {
		g.capture(.05)
	}
	if b.Owner != 0 || b.Stage != "active" {
		t.Fatalf("base did not commission: %+v", b)
	}
}
func TestFlankAndNoticeWindow(t *testing.T) {
	g := battle(t, 0)
	a, b := g.Squads[13], g.Squads[0]
	a.X, a.Z = 0, 7
	b.X, b.Z, b.Facing = 0, 0, 0
	front, arc := g.attackMultiplier(a, b)
	if arc != "front" {
		t.Fatal(arc)
	}
	a.Z = -7
	rear, arc := g.attackMultiplier(a, b)
	if arc != "rear" || rear < front*3 {
		t.Fatalf("lancer flank should overcome poor front matchup: front=%f rear=%f", front, rear)
	}
	g.Time = 10
	g.damageSquad(b, 10, 3, a.ID, "rear")
	if b.Notice < 12 {
		t.Fatal("heavy cavalry notice window missing")
	}
	facing := b.Facing
	g.moveSquads(.05)
	if b.Facing != facing {
		t.Fatal("defender rotated during notice window")
	}
	deadline := b.Notice
	g.Time += .5
	g.damageSquad(b, 10, 3, a.ID, "rear")
	if b.Notice != deadline {
		t.Fatal("same attacker must not indefinitely reset notice")
	}
}
func TestRespawnCooldownAndCapacity(t *testing.T) {
	g := battle(t, 0)
	s := g.Squads[0]
	spec := g.spec(s)
	g.damageSquad(s, 1e8, 1, 5, "front")
	g.Time = spec.Cooldown - .01
	g.reinforce()
	if s.Alive != 0 {
		t.Fatal("respawn before cooldown")
	}
	g.Time += .02
	g.reinforce()
	if s.Alive != 25 {
		t.Fatal("squad failed to respawn")
	}
	g.Outposts[0].Owner = 0
	g.updateCapacity()
	extra := g.addSquad(0, 1, true)
	g.Outposts[0].Owner = -1
	g.updateCapacity()
	g.Time += 100
	g.reinforce()
	if extra.Alive != 0 {
		t.Fatal("over-capacity reinforcement must wait")
	}
	g.Outposts[0].Owner = 0
	g.updateCapacity()
	g.reinforce()
	if extra.Alive != 25 {
		t.Fatal("reinforcement should resume when capacity returns")
	}
}
func TestPartialReinforcementAtBaseOnly(t *testing.T) {
	g := battle(t, 0)
	s := g.Squads[0]
	g.damageSquad(s, g.spec(s).HP*3, 1, 5, "front")
	if s.Alive != 22 {
		t.Fatal(s.Alive)
	}
	s.X, s.Z = 0, 60
	g.Time = 100
	g.reinforce()
	if s.Alive != 22 {
		t.Fatal("replenished outside base")
	}
	s.X, s.Z = -56, -56
	g.reinforce()
	if s.Alive != 25 {
		t.Fatal("base did not replenish casualties")
	}
}
func TestCommandsAreOwnerScoped(t *testing.T) {
	g := battle(t, 0)
	enemy := g.Squads[4]
	g.command(0, Command{Type: "order", IDs: []int{enemy.ID}, Order: "move", X: 0, Z: 0})
	g.command(0, Command{Type: "formation", IDs: []int{enemy.ID}, Formation: 2})
	if len(enemy.Path) > 0 || enemy.Formation != 0 {
		t.Fatal("client commanded another player's army")
	}
	if g.command(0, Command{Type: "recruit", Class: 0}) == nil {
		t.Fatal("capacity bypass")
	}
	if g.command(0, Command{Type: "order", Order: "move", X: math.NaN()}) == nil {
		t.Fatal("non-finite command accepted")
	}
}

func TestNoticePreventsInstantRearRetaliation(t *testing.T) {
	g := battle(t, 0)
	defender, attacker := g.Squads[0], g.Squads[13]
	for _, s := range g.Squads {
		s.Alive = 0
		s.HP = 0
	}
	defender.Alive = 25
	defender.HP = 3875
	defender.X = 0
	defender.Z = 60
	defender.Facing = 0
	attacker.Alive = 25
	attacker.HP = 2625
	attacker.X = 0
	attacker.Z = 53
	attacker.Facing = 0
	defender.Notice = 2
	before := attacker.HP
	g.combat()
	if attacker.HP != before {
		t.Fatal("defender attacked behind itself before turning")
	}
	if defender.HP >= 3875 {
		t.Fatal("rear attacker should deal damage")
	}
}

func TestHeroSpawnsOutsideBaseAndCameraHasRoom(t *testing.T) {
	g := battle(t, 0)
	for _, h := range g.Heroes {
		b := g.mainBase(h.Owner)
		if dist(h.X, h.Z, b.X, b.Z) < 24 || !g.nav.walkable(h.X, h.Z, .7) {
			t.Fatal("hero spawned inside a building")
		}
	}
}
func TestHeroBlockDodgeAndInputBounds(t *testing.T) {
	g := battle(t, 0)
	h := g.hero(0)
	h.X, h.Z, h.Facing = 0, 50, 0
	h.Active = true
	g.command(0, Command{Type: "input", Input: HeroInput{X: 100, Z: 100}})
	if math.Hypot(h.Input.X, h.Input.Z) > 1.001 {
		t.Fatal("speed hack accepted")
	}
	h.Block = true
	hp := h.HP
	g.damageHero(h, 100, 0, 55)
	if math.Abs(hp-h.HP-22) > .01 {
		t.Fatal("frontal block incorrect")
	}
	hp = h.HP
	g.damageHero(h, 100, 0, 45)
	if math.Abs(hp-h.HP-100) > .01 {
		t.Fatal("rear damage incorrectly blocked")
	}
	h.DodgeUntil = 1
	hp = h.HP
	g.damageHero(h, 100, 0, 50)
	if h.HP != hp {
		t.Fatal("dodge invulnerability missing")
	}
	g.Time = 1.1
	g.moveHeroes(.05)
	if h.Input.X != 0 || h.Input.Block {
		t.Fatal("stale hero input not cleared")
	}
}
func TestAllMapPathsAvoidObstacles(t *testing.T) {
	for _, m := range rules.Maps {
		n := NewNav(m)
		for _, a := range corners {
			a.X -= math.Copysign(14, a.X)
			a.Z -= math.Copysign(14, a.Z)
			for _, b := range posts {
				path := n.path(a.X, a.Z, b.X, b.Z)
				if len(path) == 0 {
					t.Fatalf("map %d has disconnected objective", m.ID)
				}
				previous := a
				for _, p := range path {
					if !n.line(previous, p) {
						t.Fatalf("path crosses obstacle on map %d: %+v -> %+v", m.ID, previous, p)
					}
					previous = p
				}
				if dist(previous.X, previous.Z, b.X, b.Z) > 6 {
					t.Fatal("path did not reach objective")
				}
			}
		}
	}
}
func TestFullBotMatchesStayFinite(t *testing.T) {
	for mapID := range rules.Maps {
		g := battle(t, mapID)
		for _, p := range g.Players {
			p.Bot = true
		}
		for i := 0; i < 24001 && g.Phase == "battle"; i++ {
			g.step(.05)
		}
		if g.Phase != "finished" {
			t.Fatalf("map %d match never finished", mapID)
		}
		for _, s := range g.Squads {
			if !finite(s.X) || !finite(s.Z) || !finite(s.HP) || s.Alive < 0 || s.Alive > 25 {
				t.Fatalf("invalid state %+v", s)
			}
		}
		t.Logf("map=%d winner=%d squads=%d time=%.0f", mapID, g.Winner, len(g.Squads), g.Time)
	}
}
func BenchmarkFourPlayerTick(b *testing.B) {
	g := NewGame("BENCH", 0, 0)
	g.Players[0] = &Player{ID: 0, Faction: 0}
	g.start(true)
	for _, p := range g.Players {
		p.Bot = true
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if g.Phase == "finished" {
			g.Phase = "battle"
			g.Time = 0
		}
		g.step(.05)
	}
}
