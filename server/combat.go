package main

import "math"

// One contact per attacking soldier, using the existing lightweight bodies.
type unitContact struct {
	offense                    float64
	shape                      string
	from, to                   *SoldierBody
	shooter                    *Hero
	skill, flying              bool
	originX, originZ, interval float64
	hero                       *Hero
	base                       *Base
	x, z                       float64
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
	return n.clearSegment(ax, az, bx, bz, .03)
}

func (n *Nav) clearSegment(ax, az, bx, bz, margin float64) bool {
	dx, dz := bx-ax, bz-az
	d2 := dx*dx + dz*dz
	for _, o := range n.obstacles {
		t := 0.
		if d2 > 1e-9 {
			t = clamp(((o.X-ax)*dx+(o.Z-az)*dz)/d2, 0, 1)
		}
		x, z := ax+t*dx-o.X, az+t*dz-o.Z
		r := o.R + margin
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
				cell := x + z*crowdGridN
				bucket := g.bucket(cell)
				if bucket.owners & ^uint8(1<<s.Owner) == 0 {
					continue
				}
				for i := int(bucket.head) - 1; i >= 0; i = g.bodies[i].Next {
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
	return g.hasContactAgainst(s, nil)
}

func (g *Game) hasContactAgainst(s, enemy *Squad) bool {
	sn, cs := math.Sin(s.Facing), math.Cos(s.Facing)
	reach := weaponReach(g.spec(s).Kind)
	for _, slot := range s.Slots {
		a := &s.Bodies[slot]
		if !a.Ready {
			continue
		}
		c := g.contactFor(s, a, reach, sn, cs)
		if c.from != nil && (enemy == nil || c.to != nil && c.to.Squad == enemy) {
			return true
		}
	}
	return false
}

func (g *Game) resolveContact(c unitContact, interval float64) {
	owner, attacker, x, z := c.source()
	if c.flying {
		x, z = c.originX, c.originZ
	}
	damage := 0.
	if c.shooter != nil {
		damage = rules.Heroes[c.shooter.Class].Damage
		if c.skill {
			damage *= 2.2
		}
	} else {
		damage = g.spec(c.from.Squad).Damage * interval
	}
	hit := HitTarget{Slot: -1, X: c.x, Z: c.z}
	if c.shooter == nil && c.to == nil {
		if c.flying {
			damage *= c.offense
		} else {
			damage *= g.attackOffense(c.from.Squad, x, z)
		}
	}
	if b := c.to; b != nil {
		if !b.Ready || b.Squad.Alive == 0 || b.Squad.Owner == owner {
			return
		}
		t := b.Squad
		m, flank := g.defenseMultiplierAt(t, x, z, b.X, b.Z)
		if c.shooter == nil {
			if c.flying {
				m, flank = g.attackMultiplierWith(c.from.Squad, t, x, z, b.X, b.Z, c.shape, c.offense)
			} else {
				m, flank = g.attackMultiplierAt(c.from.Squad, t, x, z, b.X, b.Z)
			}
		}
		before := t.HP
		g.damageSquad(t, damage*m, owner, attacker, flank)
		t.HitSlots |= 1 << b.Slot
		syncSlots(t, b.Slot)
		hit.Kind, hit.ID, hit.Slot, hit.X, hit.Z, hit.Damage = "soldier", t.ID, b.Slot, b.X, b.Z, before-t.HP
	} else if h := c.hero; h != nil {
		if h.HP <= 0 || h.Owner == owner {
			return
		}
		hit.Blocked = h.Block && h.Stamina >= 5 && math.Abs(angle(math.Atan2(x-h.X, z-h.Z)-h.Facing)) < 1.5
		before := h.HP
		g.damageHero(h, damage, x, z)
		hit.Kind, hit.ID, hit.X, hit.Z, hit.Damage = "hero", h.Owner, h.X, h.Z, before-h.HP
	} else if b := c.base; b != nil && b.Stage == "active" && b.Owner != owner {
		before := b.HP
		scale := .8
		if c.shooter != nil {
			scale = .6
		}
		b.HP = math.Max(0, b.HP-damage*scale)
		hit.Kind, hit.ID, hit.Damage = "base", b.ID, before-b.HP
		if b.HP == 0 {
			g.event(owner, "base", "Üs yıkıldı. Bölgede kalarak faaliyete geçir.")
			b.Stage, b.Owner, b.Progress, b.Captor = "ruined", -1, 0, -1
		}
	}
	if h := c.shooter; h != nil && hit.Damage > 0 {
		if h.hitEpoch != g.hitEpoch || g.Time-h.ImpactAt > .11 {
			h.HitTargets = h.HitTargets[:0]
		}
		h.hitEpoch = g.hitEpoch
		if len(h.HitTargets) >= 8 {
			copy(h.HitTargets, h.HitTargets[1:])
			h.HitTargets = h.HitTargets[:7]
		}
		h.HitTargets = append(h.HitTargets, hit)
		first := h.HitTargets[0]
		kind := "hit"
		if first.Blocked {
			kind = "block"
		}
		g.heroImpact(h, first.X, first.Z, first.Damage, kind)
	}
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
