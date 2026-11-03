package main

import (
	"fmt"
	"math"
)

var corners, posts [4]Vec

func quadrants(offset float64) [4]Vec {
	return [4]Vec{{-offset, -offset}, {-offset, offset}, {offset, -offset}, {offset, offset}}
}

func NewGame(code string, mapID, host int) *Game {
	if mapID < 0 || mapID >= len(rules.Maps) {
		mapID = 0
	}
	return &Game{Type: "state", Room: code, Phase: "lobby", Map: mapID, Host: host, Players: make([]*Player, 4), Squads: []*Squad{}, Bases: []*Base{}, Outposts: []*Outpost{}, Heroes: []*Hero{}, Events: []Event{}, Winner: -1, nextID: 1, nav: NewNav(rules.Maps[mapID])}
}
func (g *Game) start(bots bool) error {
	if g.Phase != "lobby" {
		return fmt.Errorf("Savaş zaten başladı")
	}
	count := 0
	for _, p := range g.Players {
		if p != nil {
			count++
		}
	}
	if count < 2 && !bots {
		return fmt.Errorf("En az 2 oyuncu gerekli; boş slotları botlarla doldurabilirsin")
	}
	for i := 0; i < 4; i++ {
		if g.Players[i] == nil && bots {
			g.Players[i] = &Player{ID: i, Faction: i, Name: rules.Factions[i].Name + " · AI", Bot: true, HeroClass: i % 3, MainBase: i}
		}
		v := corners[i]
		owner := i
		stage := "active"
		hp := 6000.0
		if g.Players[i] == nil {
			owner = -1
			stage = "ruined"
			hp = 0
		}
		g.Bases = append(g.Bases, &Base{ID: i, Owner: owner, X: v.X, Z: v.Z, HP: hp, Stage: stage, Captor: -1})
		o := posts[i]
		g.Outposts = append(g.Outposts, &Outpost{ID: i, Owner: -1, X: o.X, Z: o.Z, Captor: -1})
	}
	for i, p := range g.Players {
		if p == nil {
			continue
		}
		p.Capacity = 100
		p.MainBase = i
		for c := 0; c < 4; c++ {
			g.addSquad(i, c, false)
		}
		v := corners[i]
		hs := rules.Heroes[p.HeroClass]
		a := math.Atan2(-v.X, -v.Z)
		g.Heroes = append(g.Heroes, &Hero{Owner: i, Class: p.HeroClass, X: v.X + math.Sin(a)*25, Z: v.Z + math.Cos(a)*25, HP: hs.HP, Stamina: 100, Facing: a})
	}
	g.Phase = "battle"
	g.stepCrowd(.05)
	g.crowdSnapshot()
	g.event(-1, "start", "Dört sancak, tek savaş alanı. Outpostları ele geçir.")
	return nil
}
func (g *Game) addSquad(owner, class int, queued bool) *Squad {
	p := g.Players[owner]
	b := g.mainBase(owner)
	if b == nil {
		return nil
	}
	v := g.spawnPoint(owner, g.nextID)
	s := &Squad{ID: g.nextID, Owner: owner, Class: class, X: v.X, Z: v.Z, Facing: math.Atan2(-v.X, -v.Z), Order: "hold", Target: -1, LastAttacker: -1}
	g.nextID++
	spec := rules.Factions[p.Faction].Units[class]
	s.HP = spec.HP * 25
	s.Alive = 25
	if queued {
		s.HP = 0
		s.Alive = 0
		s.Respawn = g.Time + spec.Cooldown
	}
	g.Squads = append(g.Squads, s)
	return s
}
func (g *Game) spawnPoint(owner, seed int) Vec {
	b := g.mainBase(owner)
	if b == nil {
		return Vec{}
	}
	a := math.Atan2(-b.X, -b.Z)
	side := float64(seed%4) - 1.5
	return Vec{b.X + math.Sin(a)*14 + math.Cos(a)*side*7, b.Z + math.Cos(a)*14 - math.Sin(a)*side*7}
}
func (g *Game) mainBase(owner int) *Base {
	p := g.Players[owner]
	if p == nil {
		return nil
	}
	for _, b := range g.Bases {
		if b.ID == p.MainBase && b.Owner == owner && b.Stage == "active" {
			return b
		}
	}
	return nil
}
func (g *Game) updateCapacity() {
	for _, p := range g.Players {
		if p == nil {
			continue
		}
		bases := 0
		mainValid := false
		first := -1
		for _, b := range g.Bases {
			if b.Owner == p.ID && b.Stage == "active" {
				bases++
				if first < 0 {
					first = b.ID
				}
				if b.ID == p.MainBase {
					mainValid = true
				}
			}
		}
		if !mainValid {
			old := p.MainBase
			p.MainBase = first
			if first >= 0 && old != first {
				g.event(p.ID, "base", rules.Factions[p.Faction].Name+": yeni ana üs faaliyette")
			}
		}
		capacity := 0
		if bases > 0 {
			capacity = 100 + (bases-1)*50
		}
		for _, o := range g.Outposts {
			if o.Owner == p.ID {
				capacity += 25
			}
		}
		p.Capacity = capacity
	}
}
func (g *Game) roster(owner int) int {
	n := 0
	for _, s := range g.Squads {
		if s.Owner == owner {
			n += 25
		}
	}
	return n
}
func (g *Game) squad(id int) *Squad {
	for _, s := range g.Squads {
		if s.ID == id {
			return s
		}
	}
	return nil
}
func (g *Game) hero(owner int) *Hero {
	for _, h := range g.Heroes {
		if h.Owner == owner {
			return h
		}
	}
	return nil
}
func (g *Game) command(owner int, c Command) error {
	p := g.Players[owner]
	if p == nil {
		return fmt.Errorf("Oyuncu bulunamadı")
	}
	if c.Type == "start" {
		if owner != g.Host {
			return fmt.Errorf("Savaşı yalnızca oda sahibi başlatabilir")
		}
		return g.start(c.Bots)
	}
	if g.Phase != "battle" || p.Eliminated {
		return fmt.Errorf("Savaş aktif değil")
	}
	switch c.Type {
	case "order":
		if !finite(c.X) || !finite(c.Z) || len(c.IDs) > 20 {
			return fmt.Errorf("Geçersiz komut")
		}
		if c.Order != "move" && c.Order != "attackmove" && c.Order != "attack" && c.Order != "hold" && c.Order != "retreat" {
			return fmt.Errorf("Geçersiz emir")
		}
		selected := []*Squad{}
		seen := map[int]bool{}
		for _, id := range c.IDs {
			s := g.squad(id)
			if s != nil && s.Owner == owner && s.Alive > 0 && !seen[id] {
				selected = append(selected, s)
				seen[id] = true
			}
		}
		for i, s := range selected {
			tx, tz := clamp(c.X, -orderLimit, orderLimit), clamp(c.Z, -orderLimit, orderLimit)
			if c.Order == "retreat" {
				v := g.spawnPoint(owner, s.ID)
				if g.mainBase(owner) == nil {
					continue
				}
				tx, tz = v.X, v.Z
			}
			if len(selected) > 1 && c.Order != "attack" && c.Order != "hold" {
				tx += float64(i%3-1) * 10
				tz += float64(i/3) * 10
			}
			s.Order = c.Order
			s.MeleeTarget = 0
			s.Target = c.Target
			s.TargetX = tx
			s.TargetZ = tz
			if c.Order == "hold" {
				s.Path = nil
			} else {
				s.Path = g.nav.path(s.X, s.Z, tx, tz)
			}
			s.Repath = 0
		}
	case "formation":
		if c.Formation < 0 || c.Formation > 2 {
			return fmt.Errorf("Geçersiz dizilim")
		}
		for _, id := range c.IDs {
			if s := g.squad(id); s != nil && s.Owner == owner && s.Formation != c.Formation {
				s.Formation = c.Formation
				s.Reform = g.Time + 1.4
			}
		}
	case "recruit":
		if c.Class < 0 || c.Class > 3 {
			return fmt.Errorf("Geçersiz sınıf")
		}
		if g.mainBase(owner) == nil {
			return fmt.Errorf("Önce bir üssü faaliyete geçir")
		}
		if g.roster(owner)+25 > p.Capacity {
			return fmt.Errorf("Kapasite dolu. Outpost veya üs ele geçir")
		}
		g.addSquad(owner, c.Class, true)
	case "dismiss":
		for _, id := range c.IDs {
			for i, s := range g.Squads {
				if s.ID == id && s.Owner == owner && !s.Engaged {
					s.Alive, s.HP = 0, 0
					syncSlots(s, -1)
					g.Squads = append(g.Squads[:i], g.Squads[i+1:]...)
					break
				}
			}
		}
	case "hero":
		h := g.hero(owner)
		if h != nil {
			if h.Active != c.Active {
				h.endSwordChain()
			}
			h.Active = c.Active
			h.Input = HeroInput{Facing: h.Facing}
			h.Block = false
		}
	case "input":
		h := g.hero(owner)
		if h == nil || !h.Active {
			return nil
		}
		if !finite(c.Input.X) || !finite(c.Input.Z) || !finite(c.Input.Facing) {
			return fmt.Errorf("Geçersiz girdi")
		}
		h.Input = c.Input
		l := math.Hypot(h.Input.X, h.Input.Z)
		if l > 1 {
			h.Input.X /= l
			h.Input.Z /= l
		}
		h.Input.Facing = angle(h.Input.Facing)
		h.InputAt = g.Time
	case "action":
		g.heroAction(owner, c.Action)
	default:
		return fmt.Errorf("Bilinmeyen komut")
	}
	return nil
}
func (g *Game) step(dt float64) {
	g.Tick++
	if g.Phase != "battle" {
		return
	}
	g.Time += dt
	g.updateCapacity()
	g.moveSquads(dt)
	g.stepCrowd(dt)
	g.moveHeroes(dt)
	g.combat()
	g.capture(dt)
	g.reinforce()
	g.crowdSnapshot()
	if g.Time >= g.botAt {
		g.botAt = g.Time + 3
		g.bots()
	}
	g.checkVictory()
}
func (g *Game) nearestEnemy(s *Squad, limit float64) *Squad {
	var enemy *Squad
	best := limit
	for _, t := range g.Squads {
		if t.Owner == s.Owner || t.Alive == 0 {
			continue
		}
		d := dist(s.X, s.Z, t.X, t.Z)
		if d < best {
			best = d
			enemy = t
		}
	}
	return enemy
}
func (g *Game) speed(s *Squad) float64 {
	spec := g.spec(s)
	f := g.formation(s)
	v := spec.Speed * f.Speed
	t := g.terrain(s.X, s.Z)
	switch t {
	case "forest":
		if mounted(spec.Kind) {
			v *= 0.58
		} else if g.Players[s.Owner].Faction == 1 {
			v *= 1.12
		} else {
			v *= 0.85
		}
	case "sand":
		if spec.Kind == "camel" {
			v *= 1.15
		} else if mounted(spec.Kind) {
			v *= 0.92
		}
	case "marsh":
		v *= 0.6
		if spec.Armor > 0.25 {
			v *= 0.8
		}
	case "hill":
		v *= 0.88
	case "pass":
		if f.Shape == "line" || f.Shape == "crescent" || f.Shape == "wedge" {
			v *= 0.8
		}
	}
	if g.Time < s.Reform {
		v *= 0.5
	}
	return v
}
func (g *Game) rangeOf(s *Squad) float64 {
	spec := g.spec(s)
	r := spec.Range
	if ranged(spec.Kind) {
		if g.terrain(s.X, s.Z) == "hill" {
			r *= 1.2
		}
		if g.Players[s.Owner].Faction == 0 && s.Formation == 2 {
			r *= 1.15
		}
	}
	return r
}
func (g *Game) moveSquads(dt float64) {
	for _, s := range g.Squads {
		s.moving = false
		if s.Alive == 0 {
			continue
		}
		s.Engaged = false
		previousTarget := s.MeleeTarget
		s.MeleeTarget = 0
		spec := g.spec(s)
		rangeV := g.rangeOf(s)
		var enemy *Squad
		if s.Order == "attack" && s.Target > 0 && s.Target < 1000 {
			enemy = g.squad(s.Target)
			if enemy != nil && (enemy.Owner == s.Owner || enemy.Alive == 0) {
				enemy = nil
			}
		}
		if enemy == nil && s.Order != "move" && s.Order != "retreat" {
			enemy = g.nearestEnemy(s, math.Max(22, rangeV))
		}
		desired := s.Facing
		stop := false
		if enemy != nil {
			d := dist(s.X, s.Z, enemy.X, enemy.Z)
			desired = math.Atan2(enemy.X-s.X, enemy.Z-s.Z)
			s.Engaged = d < rangeV+2
			inReach := false
			if ranged(spec.Kind) {
				inReach = d <= rangeV && g.nav.line(Vec{s.X, s.Z}, Vec{enemy.X, enemy.Z})
			} else {
				inReach = g.hasMeleeContact(s)
				if (s.Order == "attack" || s.Order == "attackmove") && (s.Target < 1000 || s.Order == "attackmove") && d < 26 &&
					(inReach || previousTarget == enemy.ID) && g.nav.clearShot(s.X, s.Z, enemy.X, enemy.Z) {
					g.pressAttack(s, enemy, nil, previousTarget)
					inReach = true
				}
			}
			if inReach {
				stop = true
			} else if s.Order != "hold" && g.Time > s.Repath {
				s.Path = g.nav.path(s.X, s.Z, enemy.X, enemy.Z)
				s.Repath = g.Time + 0.8
			}
		}
		if s.Order == "attack" && s.Target >= 1000 {
			id := s.Target - 1000
			if id >= 0 && id < len(g.Bases) {
				b := g.Bases[id]
				if b.Owner != s.Owner && b.HP > 0 {
					desired = math.Atan2(b.X-s.X, b.Z-s.Z)
					inReach := dist(s.X, s.Z, b.X, b.Z) < rangeV+7
					if !ranged(spec.Kind) {
						inReach = g.hasMeleeContact(s)
						if dist(s.X, s.Z, b.X, b.Z) < 26 && (inReach || previousTarget == s.Target) {
							g.pressAttack(s, nil, b, previousTarget)
							inReach = true
						}
					}
					if inReach {
						stop = true
						s.Engaged = true
					}
				}
			}
		}
		if previousTarget != 0 && enemy == nil && s.Order == "attackmove" {
			s.Path = g.nav.path(s.X, s.Z, s.TargetX, s.TargetZ)
		}
		if !stop && len(s.Path) > 0 {
			v := s.Path[0]
			d := dist(s.X, s.Z, v.X, v.Z)
			if d < 0.3 {
				s.Path = s.Path[1:]
			} else {
				speed := g.speed(s)
				step := math.Min(speed*dt, d)
				nx, nz := s.X+(v.X-s.X)/d*step, s.Z+(v.Z-s.Z)/d*step
				s.X = nx
				s.Z = nz
				s.moving = step > 0
				s.Travel += step
				desired = math.Atan2(v.X-s.X, v.Z-s.Z)
			}
		}
		if g.Time >= s.Notice {
			turn := 2.5
			if mounted(spec.Kind) {
				turn = 1.5
			}
			s.Facing = angle(s.Facing + clamp(angle(desired-s.Facing), -turn*dt, turn*dt))
		}
		// Light separation keeps independently commanded squads readable.
		for _, t := range g.Squads {
			if t.ID >= s.ID || t.Alive == 0 {
				continue
			}
			d := dist(s.X, s.Z, t.X, t.Z)
			if d < 6 && d > 0.01 {
				push := (6 - d) * dt
				nx, nz := s.X+(s.X-t.X)/d*push, s.Z+(s.Z-t.Z)/d*push
				if g.nav.walkable(nx, nz, 3.8) {
					s.X = nx
					s.Z = nz
				}
			}
		}
	}
}

// Shared by soldier and hero attacks. A circle has no exposed defensive side;
// flank identity remains available for class counters and the notice window.
func (g *Game) defenseMultiplier(b *Squad, x, z float64) (float64, string) {
	return g.defenseMultiplierAt(b, x, z, b.X, b.Z)
}
func (g *Game) defenseMultiplierAt(b *Squad, x, z, tx, tz float64) (float64, string) {
	bf := g.formation(b)
	bearing := math.Atan2(x-tx, z-tz)
	arc := math.Abs(angle(bearing - b.Facing))
	m := 1.0
	flank := "front"
	if arc > 2.15 {
		m = 2 * bf.Rear
		flank = "rear"
	} else if arc > 1.05 {
		m = 1.4
		flank = "side"
	} else {
		m = bf.Front
	}
	if bf.Shape == "circle" {
		m = bf.Front
	}
	return m * (1 - g.spec(b).Armor), flank
}

func (g *Game) attackMultiplier(a, b *Squad) (float64, string) {
	return g.attackMultiplierAt(a, b, a.X, a.Z, b.X, b.Z)
}
func (g *Game) attackMultiplierAt(a, b *Squad, ax, az, bx, bz float64) (float64, string) {
	return g.attackMultiplierWith(a, b, ax, az, bx, bz, g.formation(a).Shape, g.attackOffense(a, ax, az))
}
func (g *Game) attackMultiplierWith(a, b *Squad, ax, az, bx, bz float64, shape string, offense float64) (float64, string) {
	as, bs := g.spec(a), g.spec(b)
	bf := g.formation(b)
	m, flank := g.defenseMultiplierAt(b, ax, az, bx, bz)
	if as.Kind == "lancer" && bs.Kind == "cavalry" {
		if flank == "front" {
			m *= 0.62
		} else {
			m *= 1.5
		}
	}
	if as.Kind == "spear" && mounted(bs.Kind) && flank == "front" {
		m *= 1.45
	}
	if as.Kind == "camel" && mounted(bs.Kind) {
		m *= 1.25
	}
	if as.Kind == "cavalry" && a.Travel > 12 && shape == "wedge" {
		m *= 1.25
	}
	if as.Kind == "axe" || as.Kind == "berserker" {
		m *= 1 + bs.Armor*0.9
	}
	if shape == "crescent" && flank != "front" {
		m *= 1.2
	}
	if as.Kind == "lancer" && shape == "wedge" && flank != "front" {
		m *= 1.2
	}
	if ranged(as.Kind) {
		if bf.Shape == "loose" {
			m *= 0.75
		}
		if g.terrain(bx, bz) == "forest" {
			m *= 0.72
		}
		if dist(ax, az, bx, bz) < 10 {
			m *= 0.48
		}
	}
	return m * offense, flank
}
func (g *Game) attackOffense(a *Squad, x, z float64) float64 {
	kind, af := g.spec(a).Kind, g.formation(a)
	m := af.Attack
	if kind == "horseArcher" && a.moving && af.Shape != "loose" {
		m *= .65
	}
	if mounted(kind) && g.terrain(x, z) == "forest" {
		m *= 0.72
	}
	if g.Time < a.Reform {
		m *= 0.8
	}
	return m
}
func (g *Game) damageSquad(s *Squad, damage float64, owner, attacker int, flank string) {
	if s.Alive == 0 {
		return
	}
	old := s.Alive
	if s.hitEpoch != g.hitEpoch || g.Time-s.Flash > .11 {
		s.HitSlots = 0
	}
	s.hitEpoch = g.hitEpoch
	spec := g.spec(s)
	s.HP = math.Max(0, s.HP-damage)
	s.Alive = int(math.Ceil(s.HP / spec.HP))
	s.Flash = g.Time
	s.Flank = flank
	if flank != "front" && attacker != s.LastAttacker && g.Time >= s.Notice {
		s.Notice = g.Time + spec.Notice
		s.LastAttacker = attacker
	}
	s.LastHit = g.Time
	for i := s.Alive; i < old; i++ {
		s.Missing = append(s.Missing, g.Time+spec.Cooldown)
	}
	if owner >= 0 && owner < 4 && g.Players[owner] != nil {
		g.Players[owner].Kills += old - s.Alive
	}
	if s.Alive == 0 {
		s.Respawn = g.Time + spec.Cooldown
		s.Path = nil
		s.Order = "hold"
		g.event(s.Owner, "loss", spec.Short+" birliği düştü · takviye bekleniyor")
	}
}
func (g *Game) presence(x, z, r float64) (int, bool) {
	owner := -1
	contested := false
	for _, s := range g.Squads {
		if s.Alive > 0 && dist(x, z, s.X, s.Z) < r {
			if owner >= 0 && owner != s.Owner {
				contested = true
			}
			owner = s.Owner
		}
	}
	for _, h := range g.Heroes {
		if h.HP > 0 && dist(x, z, h.X, h.Z) < r {
			if owner >= 0 && owner != h.Owner {
				contested = true
			}
			owner = h.Owner
		}
	}
	return owner, contested
}
func (g *Game) capture(dt float64) {
	for _, o := range g.Outposts {
		owner, contested := g.presence(o.X, o.Z, 12)
		o.Contested = contested
		if contested {
			continue
		}
		if owner < 0 || owner == o.Owner {
			o.Progress = math.Max(0, o.Progress-dt/12)
			continue
		}
		if o.Captor != owner {
			o.Captor = owner
			o.Progress = 0
		}
		o.Progress += dt / 9
		if o.Progress >= 1 {
			o.Owner = owner
			o.Progress = 0
			o.Captor = -1
			g.event(owner, "capture", fmt.Sprintf("%s · Outpost %d ele geçirildi (+25)", rules.Factions[owner].Name, o.ID+1))
		}
	}
	for _, b := range g.Bases {
		if b.Stage == "active" {
			if b.HP < 6000 {
				owner, contested := g.presence(b.X, b.Z, 22)
				if !contested && (owner < 0 || owner == b.Owner) {
					b.HP = math.Min(6000, b.HP+dt*20)
				}
			}
			continue
		}
		owner, contested := g.presence(b.X, b.Z, 15)
		b.Contested = contested
		if contested || owner < 0 {
			continue
		}
		if b.Captor != owner {
			b.Captor = owner
			b.Progress = 0
		}
		b.Stage = "rebuilding"
		b.Progress += dt / 14
		if b.Progress >= 1 {
			b.Owner = owner
			b.Stage = "active"
			b.HP = 6000
			b.Progress = 0
			b.Captor = -1
			g.event(owner, "base", rules.Factions[owner].Name+" · yeni üs faaliyette")
		}
	}
}
func (g *Game) reinforce() {
	used := [4]int{}
	for _, s := range g.Squads {
		used[s.Owner] += 25
		p := g.Players[s.Owner]
		b := g.mainBase(s.Owner)
		if b == nil || used[s.Owner] > p.Capacity {
			continue
		}
		spec := g.spec(s)
		if s.Alive == 0 && g.Time >= s.Respawn {
			v := g.spawnPoint(s.Owner, s.ID)
			s.X = v.X
			s.Z = v.Z
			s.HP = spec.HP * 25
			s.Alive = 25
			s.Missing = nil
			s.Respawn = 0
			s.Notice = 0
			s.Facing = math.Atan2(-s.X, -s.Z)
			continue
		}
		if s.Alive > 0 && s.Alive < 25 && g.Time-s.LastHit > 3 {
			near := false
			for _, base := range g.Bases {
				if base.Owner == s.Owner && base.Stage == "active" && dist(s.X, s.Z, base.X, base.Z) < 28 {
					near = true
				}
			}
			if near {
				remaining := s.Missing[:0]
				for _, at := range s.Missing {
					if g.Time >= at {
						s.HP = math.Min(spec.HP*25, s.HP+spec.HP)
					} else {
						remaining = append(remaining, at)
					}
				}
				s.Missing = remaining
				s.Alive = int(math.Ceil(s.HP / spec.HP))
			}
		}
	}
}
func (g *Game) bots() {
	for _, p := range g.Players {
		if p == nil || !p.Bot || p.Eliminated {
			continue
		}
		if g.roster(p.ID)+25 <= p.Capacity && g.mainBase(p.ID) != nil {
			g.addSquad(p.ID, int((g.Tick/60+int64(p.ID))%4), true)
		}
		for _, s := range g.Squads {
			if s.Owner != p.ID || s.Alive == 0 {
				continue
			}
			if s.Alive < 9 {
				g.command(p.ID, Command{Type: "order", IDs: []int{s.ID}, Order: "retreat"})
				continue
			}
			if s.Engaged {
				continue
			}
			best := math.MaxFloat64
			tx, tz := 0.0, 0.0
			target := -1
			for _, o := range g.Outposts {
				if o.Owner != p.ID {
					d := dist(s.X, s.Z, o.X, o.Z)
					if d < best {
						best = d
						tx = o.X
						tz = o.Z
					}
				}
			}
			for _, b := range g.Bases {
				if b.Owner != p.ID {
					penalty := 35.0
					if b.Stage != "active" {
						penalty = -15
					}
					d := dist(s.X, s.Z, b.X, b.Z) + penalty
					if d < best {
						best = d
						tx = b.X
						tz = b.Z
						target = 1000 + b.ID
					}
				}
			}
			order := "attackmove"
			if target >= 1000 {
				order = "attack"
			}
			if best < math.MaxFloat64 {
				g.command(p.ID, Command{Type: "order", IDs: []int{s.ID}, Order: order, X: tx, Z: tz, Target: target})
			}
			terrain := g.terrain(s.X, s.Z)
			if terrain == "forest" {
				g.command(p.ID, Command{Type: "formation", IDs: []int{s.ID}, Formation: 2})
			} else if g.spec(s).Kind == "spear" {
				g.command(p.ID, Command{Type: "formation", IDs: []int{s.ID}, Formation: 1})
			}
		}
	}
}
func (g *Game) checkVictory() {
	active := 0
	last := -1
	for _, p := range g.Players {
		if p == nil {
			continue
		}
		has := g.mainBase(p.ID) != nil
		for _, s := range g.Squads {
			if s.Owner == p.ID && s.Alive > 0 {
				has = true
			}
		}
		if h := g.hero(p.ID); h != nil && h.HP > 0 {
			has = true
		}
		p.Eliminated = !has
		if has {
			active++
			last = p.ID
		}
	}
	if active <= 1 {
		g.Phase = "finished"
		g.Winner = last
	}
	if g.Time >= 1200 {
		best := -1.0
		g.Winner = -1
		for _, p := range g.Players {
			if p == nil || p.Eliminated {
				continue
			}
			score := float64(p.Capacity*4 + p.Kills)
			if score > best {
				best = score
				g.Winner = p.ID
			} else if score == best {
				g.Winner = -1
			}
		}
		g.Phase = "finished"
	}
}
