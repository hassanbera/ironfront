package main

import "math"

// One contact per attacking soldier, using the existing lightweight bodies.
type unitContact struct {
	from, to *SoldierBody
	hero     *Hero
	base     *Base
	x, z     float64
}

func weaponReach(kind string) float64 {
	switch kind {
	case "spear", "lancer":
		return 2.3
	case "cavalry", "camel":
		return 1.7
	default:
		return 1.35
	}
}

// Navigation's 3.8 m formation margin must not obstruct individual weapons.
func (n *Nav) clearShot(ax, az, bx, bz float64) bool {
	dx, dz := bx-ax, bz-az
	d2 := dx*dx + dz*dz
	for _, o := range n.obstacles {
		t := 0.
		if d2 > 1e-9 {
			t = clamp(((o.X-ax)*dx+(o.Z-az)*dz)/d2, 0, 1)
		}
		x, z := ax+t*dx-o.X, az+t*dz-o.Z
		r := o.R + .03
		if x*x+z*z < r*r {
			return false
		}
	}
	return true
}

func (g *Game) contactFor(s *Squad, a *SoldierBody, reach, sn, cs float64) unitContact {
	best := unitContact{}
	bestDistance, priority := math.MaxFloat64, 2
	consider := func(c unitContact, radius float64, target int) {
		dx, dz := c.x-a.X, c.z-a.Z
		d2 := dx*dx + dz*dz
		r := reach + a.Radius + radius
		p := 1
		if s.Order == "attack" && s.Target == target {
			p = 0
		}
		if d2 > r*r || p > priority || (p == priority && d2 >= bestDistance) {
			return
		}
		// Preserve the old forward cone: notice-locked units cannot attack behind.
		dot := dx*sn + dz*cs
		if dot < 0 || dot*dot < d2*.02888882966567 {
			return
		} // cos(1.4)^2
		if !g.nav.clearShot(a.X, a.Z, c.x, c.z) {
			return
		}
		c.from = a
		best, bestDistance, priority = c, d2, p
	}
	// Reuse the crowd grid; no all-soldier pair search or per-query allocation.
	if len(g.bodies) > 0 {
		r := reach + a.Radius + 1.05
		lo, hi := crowdCell(a.X-r, a.Z-r), crowdCell(a.X+r, a.Z+r)
		for z := lo / crowdGridN; z <= hi/crowdGridN; z++ {
			for x := lo % crowdGridN; x <= hi%crowdGridN; x++ {
				for i := g.crowdHeads[x+z*crowdGridN]; i >= 0; i = g.bodies[i].Next {
					b := g.bodies[i]
					if b.Ready && b.Squad.Alive > 0 && b.Squad.Owner != s.Owner {
						consider(unitContact{to: b, x: b.X, z: b.Z}, b.Radius, b.Squad.ID)
					}
				}
			}
		}
	}
	for _, h := range g.Heroes {
		if h.HP > 0 && h.Owner != s.Owner {
			consider(unitContact{hero: h, x: h.X, z: h.Z}, heroRadius, -100-h.Owner)
		}
	}
	if s.Order != "hold" {
		for _, b := range g.Bases {
			if b.Stage != "active" || b.Owner == s.Owner {
				continue
			}
			dx, dz := a.X-b.X, a.Z-b.Z
			d := math.Hypot(dx, dz)
			if d < 1e-9 || d > 9.2+reach+a.Radius {
				continue
			}
			consider(unitContact{base: b, x: b.X + dx/d*9.2, z: b.Z + dz/d*9.2}, 0, 1000+b.ID)
		}
	}
	return best
}

func (g *Game) hasMeleeContact(s *Squad) bool {
	sn, cs := math.Sin(s.Facing), math.Cos(s.Facing)
	reach := weaponReach(g.spec(s).Kind)
	for _, slot := range s.Slots {
		a := &s.Bodies[slot]
		if a.Ready && g.contactFor(s, a, reach, sn, cs).from != nil {
			return true
		}
	}
	return false
}

func (g *Game) resolveContact(c unitContact, interval float64) {
	s := c.from.Squad
	damage := g.spec(s).Damage * interval
	if b := c.to; b != nil {
		if !b.Ready || b.Squad.Alive == 0 {
			return
		}
		m, flank := g.attackMultiplierAt(s, b.Squad, c.from.X, c.from.Z, b.X, b.Z)
		t := b.Squad
		g.damageSquad(t, damage*m, s.Owner, s.ID, flank)
		t.HitSlots |= 1 << b.Slot
		syncSlots(t, b.Slot)
	} else if h := c.hero; h != nil {
		g.damageHero(h, damage, c.from.X, c.from.Z)
	} else if b := c.base; b != nil && b.Stage == "active" && b.Owner != s.Owner {
		b.HP = math.Max(0, b.HP-damage*.8)
		if b.HP == 0 {
			g.event(s.Owner, "base", "Üs yıkıldı. Bölgede kalarak faaliyete geçir.")
			b.Stage, b.Owner, b.Progress, b.Captor = "ruined", -1, 0, -1
		}
	}
}

func (g *Game) combat() {
	g.contacts = g.contacts[:0]
	for _, s := range g.Squads {
		if s.Alive == 0 || g.Time < s.AttackTimer {
			continue
		}
		kind := g.spec(s).Kind
		if (s.Order == "move" || s.Order == "retreat") && kind != "horseArcher" {
			continue
		}
		reach := weaponReach(kind)
		if ranged(kind) {
			reach = g.rangeOf(s)
		}
		sn, cs := math.Sin(s.Facing), math.Cos(s.Facing)
		mask := uint32(0)
		x, z, n := 0., 0., 0.
		for _, slot := range s.Slots {
			a := &s.Bodies[slot]
			if !a.Ready {
				continue
			}
			c := g.contactFor(s, a, reach, sn, cs)
			if c.from == nil {
				continue
			}
			g.contacts = append(g.contacts, c)
			mask |= 1 << slot
			x += c.x
			z += c.z
			n++
		}
		if mask != 0 {
			s.AttackSlots = mask
			s.AttackAt, s.AttackTimer = g.Time, g.Time+.5
			s.AimX, s.AimZ = x/n, z/n
		}
	}
	// Choose all sides' contacts before damage to allow simultaneous exchanges.
	for _, c := range g.contacts {
		g.resolveContact(c, .5)
	}
	for _, s := range g.Squads {
		if s.AttackAt == g.Time {
			s.Travel = 0
		}
	}
	g.garrison()
}

func (g *Game) garrison() {
	for _, b := range g.Bases {
		if b.Stage != "active" || b.Owner < 0 {
			continue
		}
		for _, s := range g.Squads {
			if s.Owner != b.Owner && s.Alive > 0 && dist(s.X, s.Z, b.X, b.Z) < 19 {
				g.damageSquad(s, 26, b.Owner, -10-b.ID, "front")
				break
			}
		}
	}
}
