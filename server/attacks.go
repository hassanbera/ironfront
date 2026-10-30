package main

import "math"

// Three representative arrows per volley are enough for rendering. Damage uses
// every participating soldier's own target and arrival time on the server.
type ShotVisual struct {
	At     float64 `json:"at"`
	Land   float64 `json:"land"`
	FromX  float64 `json:"fromX"`
	FromZ  float64 `json:"fromZ"`
	Height float64 `json:"height"`
	X      float64 `json:"x"`
	Z      float64 `json:"z"`
	Kind   string  `json:"kind"`
	ID     int     `json:"id"`
	Slot   int     `json:"slot"`
}
type battleShot struct {
	contact unitContact
	land    float64
}

func (c unitContact) source() (owner, attacker int, x, z float64) {
	if c.shooter != nil {
		return c.shooter.Owner, -100 - c.shooter.Owner, c.shooter.X, c.shooter.Z
	}
	return c.from.Squad.Owner, c.from.Squad.ID, c.from.X, c.from.Z
}
func (c *unitContact) refreshTarget() bool {
	owner, _, _, _ := c.source()
	if c.to != nil {
		if !c.to.Ready || c.to.Squad.Alive <= 0 || c.to.Squad.Owner == owner {
			return false
		}
		c.x, c.z = c.to.X, c.to.Z
	} else if c.hero != nil {
		if c.hero.HP <= 0 || c.hero.Owner == owner {
			return false
		}
		c.x, c.z = c.hero.X, c.hero.Z
	} else if c.base == nil || c.base.Stage != "active" || c.base.Owner == owner {
		return false
	}
	return true
}
func (g *Game) contactStillValid(c *unitContact) bool {
	if c.from == nil || !c.from.Ready || c.from.Squad.Alive == 0 || !c.refreshTarget() {
		return false
	}
	s := c.from.Squad
	kind := g.spec(s).Kind
	reach := weaponReach(kind) + c.from.Radius
	if ranged(kind) {
		reach = g.rangeOf(s) + c.from.Radius
	}
	if c.to != nil {
		reach += c.to.Radius
	} else if c.hero != nil {
		reach += heroRadius
	}
	dx, dz := c.x-c.from.X, c.z-c.from.Z
	d2 := dx*dx + dz*dz
	dot := dx*math.Sin(s.Facing) + dz*math.Cos(s.Facing)
	return d2 <= reach*reach && dot >= 0 && dot*dot >= d2*.02888882966567 && g.nav.clearShot(c.from.X, c.from.Z, c.x, c.z)
}
func (g *Game) launchProjectile(c unitContact) ShotVisual {
	_, _, x, z := c.source()
	c.flying, c.originX, c.originZ = true, x, z
	if c.shooter == nil {
		c.offense = g.attackOffense(c.from.Squad, x, z)
		c.shape = g.formation(c.from.Squad).Shape
	}
	land := g.Time + math.Max(.08, dist(x, z, c.x, c.z)/rules.Combat.ProjectileSpeed)
	g.flights = append(g.flights, battleShot{c, land})
	v := ShotVisual{At: g.Time, Land: land, FromX: x, FromZ: z, Height: 2, X: c.x, Z: c.z, Slot: -1}
	if c.shooter != nil {
		v.Height = 1.7 + c.shooter.Y
	} else if mounted(g.spec(c.from.Squad).Kind) {
		v.Height = 3.1
	}
	if c.to != nil {
		v.Kind, v.ID, v.Slot = "soldier", c.to.Squad.ID, c.to.Slot
	} else if c.hero != nil {
		v.Kind, v.ID = "hero", c.hero.Owner
	} else {
		v.Kind, v.ID = "base", c.base.ID
	}
	return v
}

func (g *Game) startUnitAttack(s *Squad) {
	kind := g.spec(s).Kind
	cycle, duration, fraction := rules.Combat.MeleeCycle, rules.Combat.MeleeDuration, rules.Combat.ImpactFraction
	reach := weaponReach(kind)
	if ranged(kind) {
		cycle, duration, fraction = rules.Combat.RangedCycle, rules.Combat.RangedDuration, rules.Combat.ReleaseFraction
		reach = g.rangeOf(s)
	}
	sn, cs := math.Sin(s.Facing), math.Cos(s.Facing)
	s.strikeCount = 0
	mask := uint32(0)
	x, z := 0., 0.
	for _, slot := range s.Slots {
		a := &s.Bodies[slot]
		if !a.Ready {
			continue
		}
		c := g.contactFor(s, a, reach, sn, cs)
		if c.from == nil {
			continue
		}
		c.interval = cycle
		s.strikes[s.strikeCount] = c
		s.strikeCount++
		mask |= 1 << slot
		x += c.x
		z += c.z
	}
	if mask == 0 {
		s.AttackTimer = g.Time + .25
		return
	} // bounded idle probing
	s.AttackSlots = mask
	s.AttackAt, s.AttackTimer = g.Time, g.Time+cycle
	s.AttackDuration = duration
	s.AttackImpact = g.Time + duration*fraction
	s.pendingImpact = s.AttackImpact
	s.AimX, s.AimZ = x/float64(s.strikeCount), z/float64(s.strikeCount)
}

func (g *Game) combat() {
	g.contacts = g.contacts[:0]
	remaining := g.flights[:0]
	for _, shot := range g.flights {
		if shot.land > g.Time+1e-8 {
			remaining = append(remaining, shot)
			continue
		}
		c := shot.contact
		if c.refreshTarget() && g.nav.clearShot(c.originX, c.originZ, c.x, c.z) {
			g.contacts = append(g.contacts, c)
		}
	}
	g.flights = remaining
	for _, s := range g.Squads {
		kind := g.spec(s).Kind
		if s.Alive == 0 || ((s.Order == "move" || s.Order == "retreat") && kind != "horseArcher") {
			s.pendingImpact, s.strikeCount, s.AttackAt, s.AttackSlots = 0, 0, 0, 0
			continue
		}
		if s.pendingImpact > 0 && s.pendingImpact <= g.Time+1e-8 {
			s.pendingImpact = 0
			s.resolvedAt = g.Time
			if ranged(kind) {
				s.Volley = s.Volley[:0]
			}
			for i := 0; i < s.strikeCount; i++ {
				c := s.strikes[i]
				if !g.contactStillValid(&c) {
					continue
				}
				if ranged(kind) {
					v := g.launchProjectile(c)
					if len(s.Volley) < 3 {
						s.Volley = append(s.Volley, v)
					}
				} else {
					g.contacts = append(g.contacts, c)
				}
			}
			s.strikeCount = 0
		}
	}
	// Resolve this tick's simultaneous impacts before selecting any new windups.
	for _, c := range g.contacts {
		g.resolveContact(c, c.interval)
	}
	for _, s := range g.Squads {
		if s.resolvedAt == g.Time {
			s.Travel = 0
		}
		if len(s.Volley) > 0 && g.Time > s.Volley[len(s.Volley)-1].Land+.3 {
			s.Volley = s.Volley[:0]
		}
		kind := g.spec(s).Kind
		if s.Alive > 0 && g.Time+1e-8 >= s.AttackTimer && (kind == "horseArcher" || (s.Order != "move" && s.Order != "retreat")) {
			g.startUnitAttack(s)
		}
	}
	for _, h := range g.Heroes {
		if len(h.Volley) > 0 && g.Time > h.Volley[len(h.Volley)-1].Land+.3 {
			h.Volley = h.Volley[:0]
		}
	}
	if g.Time >= g.combatAt {
		g.combatAt = g.Time + .5
		g.garrison()
	}
}
