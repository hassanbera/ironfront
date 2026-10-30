package main

import (
	"math"
	"sort"
)

func (g *Game) moveHeroes(dt float64) {
	for _, h := range g.Heroes {
		spec := rules.Heroes[h.Class]
		if h.HP <= 0 {
			if g.Time >= h.Respawn && g.mainBase(h.Owner) != nil {
				b := g.mainBase(h.Owner)
				a := math.Atan2(-b.X, -b.Z)
				v := Vec{b.X + math.Sin(a)*25, b.Z + math.Cos(a)*25}
				h.X = v.X
				h.Z = v.Z
				h.HP = spec.HP
				h.Stamina = 100
				h.Respawn = 0
			}
			continue
		}
		if g.Time-h.InputAt > 0.25 {
			h.Input.X = 0
			h.Input.Z = 0
			h.Input.Block = false
		}
		if h.Active {
			h.Facing = h.Input.Facing
			h.Block = h.Input.Block && h.Stamina > 3 && g.Time >= h.DodgeUntil
			if h.Block && h.PendingStrike > 0 {
				h.PendingStrike = 0
				h.AttackAt = 0
			}
			speed := spec.Speed
			mx, mz := h.Input.X, h.Input.Z
			if h.Block {
				speed *= 0.45
				h.Stamina = math.Max(0, h.Stamina-dt*8)
			}
			if g.Time < h.DodgeUntil {
				speed *= 2.8
				mx, mz = h.DodgeX, h.DodgeZ
			} else if h.PendingStrike > 0 {
				speed *= 0.65
			}
			dx, dz := mx*speed*dt, mz*speed*dt
			g.moveHeroBody(h, dx, dz)
		} else {
			h.Block = false
			for _, s := range g.Squads {
				if s.Owner != h.Owner && s.Alive > 0 && dist(h.X, h.Z, s.X, s.Z) < 7 {
					h.Facing = math.Atan2(s.X-h.X, s.Z-h.Z)
					g.heroStrike(h, false)
					break
				}
			}
		}
		if h.PendingStrike > 0 && g.Time >= h.PendingStrike {
			h.PendingStrike = 0
			g.resolveHeroStrike(h, h.PendingSkill)
		}
		if !h.Block {
			h.Stamina = math.Min(100, h.Stamina+dt*16)
		}
		if h.Y > 0 || h.VY > 0 {
			h.VY -= 18 * dt
			h.Y = math.Max(0, h.Y+h.VY*dt)
			if h.Y == 0 {
				h.VY = 0
			}
		}
	}
}
func (g *Game) heroAction(owner int, action string) {
	h := g.hero(owner)
	if h == nil || !h.Active || h.HP <= 0 {
		return
	}
	switch action {
	case "attack":
		g.heroStrike(h, false)
	case "jump":
		if h.Y == 0 {
			h.VY = 7
		}
	case "dodge":
		if h.Stamina >= 30 && g.Time >= h.DodgeReady {
			h.Stamina -= 30
			h.DodgeUntil = g.Time + 0.3
			h.DodgeReady = g.Time + 1.1
			h.DodgeX, h.DodgeZ = h.Input.X, h.Input.Z
			l := math.Hypot(h.DodgeX, h.DodgeZ)
			if l < 0.1 {
				h.DodgeX, h.DodgeZ = -math.Sin(h.Input.Facing), -math.Cos(h.Input.Facing)
			} else {
				h.DodgeX /= l
				h.DodgeZ /= l
			}
			h.PendingStrike = 0
			h.AttackAt = 0
			h.Block = false
		}
	case "skill":
		if g.Time < h.SkillReady || h.Stamina < 25 || g.Time < h.DodgeUntil || (h.Class != 0 && (g.Time < h.AttackReady || h.Block || h.Input.Block)) {
			return
		}
		h.Stamina -= 25
		h.SkillReady = g.Time + rules.Heroes[h.Class].Cooldown
		if h.Class == 0 {
			h.GuardUntil = g.Time + 4
		} else {
			g.heroStrike(h, true)
		}
	}
}
func (g *Game) heroStrike(h *Hero, skill bool) {
	if g.Time < h.AttackReady || g.Time < h.DodgeUntil || h.Block || h.Input.Block || h.HP <= 0 {
		return
	}
	h.AttackDuration = 0.62
	if h.Class == 1 {
		h.AttackDuration = 0.55
	}
	if h.Class == 2 {
		h.AttackDuration = 0.72
	}
	if g.Time-h.AttackAt > 1.2 {
		h.Combo = 0
	}
	h.AttackKind = h.Combo % 3
	h.Combo++
	h.AttackReady = g.Time + h.AttackDuration
	h.AttackAt = g.Time
	h.AttackImpact = g.Time + h.AttackDuration*0.42
	h.PendingStrike = h.AttackImpact
	h.PendingSkill = skill
}

func (g *Game) heroImpact(h *Hero, x, z, damage float64, kind string) {
	h.ImpactAt, h.ImpactX, h.ImpactZ, h.ImpactDamage, h.ImpactKind = g.Time, x, z, damage, kind
}

func (g *Game) resolveHeroStrike(h *Hero, skill bool) {
	type candidate struct {
		kind        string
		id, slot    int
		x, z, score float64
		squad       *Squad
		hero        *Hero
		base        *Base
	}
	targets := make([]candidate, 0, 8)
	reach, arc := 3.4, 1.1
	if h.Class == 2 {
		reach, arc = 32, .3
	}
	if skill {
		arc = 1.65
		if h.Class == 2 {
			arc = .8
		}
	}
	add := func(c candidate, radius float64) {
		dx, dz := c.x-h.X, c.z-h.Z
		distance := math.Hypot(dx, dz)
		if distance > reach+radius {
			return
		}
		deviation := math.Abs(angle(math.Atan2(dx, dz) - h.Facing))
		if deviation > arc || !g.nav.line(Vec{h.X, h.Z}, Vec{c.x, c.z}) {
			return
		}
		c.score = distance + deviation*2
		targets = append(targets, c)
	}
	for _, s := range g.Squads {
		if s.Owner == h.Owner || s.Alive == 0 {
			continue
		}
		for _, slot := range s.Slots {
			b := &s.Bodies[slot]
			if b.Ready {
				add(candidate{kind: "soldier", id: s.ID, slot: slot, x: b.X, z: b.Z, squad: s}, b.Radius)
			}
		}
	}
	for _, t := range g.Heroes {
		if t.Owner != h.Owner && t.HP > 0 {
			add(candidate{kind: "hero", id: t.Owner, slot: -1, x: t.X, z: t.Z, hero: t}, heroRadius)
		}
	}
	for _, b := range g.Bases {
		if b.Stage == "active" && b.Owner != h.Owner {
			d := dist(h.X, h.Z, b.X, b.Z)
			if d > .001 {
				add(candidate{kind: "base", id: b.ID, slot: -1, x: b.X + (h.X-b.X)/d*9.2, z: b.Z + (h.Z-b.Z)/d*9.2, base: b}, 0)
			}
		}
	}
	// Sort only nearby, in-cone candidates; stable order makes equal scores deterministic.
	sort.SliceStable(targets, func(i, j int) bool { return targets[i].score < targets[j].score })
	h.HitTargets = h.HitTargets[:0]
	usedSquads := map[int]bool{}
	for _, t := range targets {
		damage := rules.Heroes[h.Class].Damage
		if skill {
			damage *= 2.2
		}
		contact := HitTarget{Kind: t.kind, ID: t.id, Slot: t.slot, X: t.x, Z: t.z}
		if s := t.squad; s != nil {
			if usedSquads[s.ID] {
				continue
			}
			usedSquads[s.ID] = true
			defense, flank := g.defenseMultiplier(s, h.X, h.Z)
			damage *= defense
			before := s.HP
			g.damageSquad(s, damage, h.Owner, -100-h.Owner, flank)
			syncSlots(s, t.slot)
			contact.Damage = before - s.HP
		} else if target := t.hero; target != nil {
			contact.Blocked = target.Block && target.Stamina >= 5 && math.Abs(angle(math.Atan2(h.X-target.X, h.Z-target.Z)-target.Facing)) < 1.5
			before := target.HP
			g.damageHero(target, damage, h.X, h.Z)
			contact.Damage = before - target.HP
		} else if b := t.base; b != nil {
			before := b.HP
			b.HP = math.Max(0, b.HP-damage*.6)
			contact.Damage = before - b.HP
			if b.HP == 0 {
				b.Owner = -1
				b.Stage = "ruined"
				b.Captor = -1
				b.Progress = 0
			}
		}
		if contact.Damage <= 0 {
			continue
		}
		h.HitTargets = append(h.HitTargets, contact)
		if !skill || len(h.HitTargets) >= 3 {
			break
		}
	}
	if len(h.HitTargets) > 0 {
		hit := h.HitTargets[0]
		kind := "hit"
		if hit.Blocked {
			kind = "block"
		}
		g.heroImpact(h, hit.X, hit.Z, hit.Damage, kind)
	}
}
func (g *Game) damageHero(h *Hero, damage, x, z float64) {
	if h.HP <= 0 || g.Time < h.DodgeUntil {
		return
	}
	a := math.Abs(angle(math.Atan2(x-h.X, z-h.Z) - h.Facing))
	if h.Block && a < 1.5 && h.Stamina >= 5 {
		h.BlockAt = g.Time
		damage *= 0.22
		h.Stamina = math.Max(0, h.Stamina-5)
	}
	if g.Time < h.GuardUntil {
		damage *= 0.4
	}
	h.HP = math.Max(0, h.HP-damage)
	if h.HP == 0 {
		h.PendingStrike = 0
		h.AttackAt = 0
		h.Respawn = g.Time + 20
		h.Block = false
		h.Input = HeroInput{}
		g.event(h.Owner, "hero", "Kahraman düştü · 20 saniye sonra ana üste dönecek")
	}
}
