package main

import "math"

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
			if g.nav.walkable(h.X+dx, h.Z, 0.7) {
				h.X += dx
			}
			if g.nav.walkable(h.X, h.Z+dz, 0.7) {
				h.Z += dz
			}
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
	spec := rules.Heroes[h.Class]
	r := 7.5
	arc := 1.2
	damage := spec.Damage
	if h.Class == 2 {
		r = 32
		arc = 0.3
	}
	if skill {
		damage *= 2.2
		arc = 1.8
		if h.Class == 2 {
			arc = 0.8
		}
	}
	hits := 0
	for _, s := range g.Squads {
		if s.Owner == h.Owner || s.Alive == 0 || dist(h.X, h.Z, s.X, s.Z) > r+3 {
			continue
		}
		a := math.Atan2(s.X-h.X, s.Z-h.Z)
		if math.Abs(angle(a-h.Facing)) > arc {
			continue
		}
		if !g.nav.line(Vec{h.X, h.Z}, Vec{s.X, s.Z}) {
			continue
		}
		bearing := math.Abs(angle(math.Atan2(h.X-s.X, h.Z-s.Z) - s.Facing))
		flank := "front"
		m := 1.0
		if bearing > 2.15 {
			flank = "rear"
			m = 1.6
		}
		before := s.HP
		g.damageSquad(s, damage*m, h.Owner, -100-h.Owner, flank)
		g.heroImpact(h, s.X, s.Z, before-s.HP, "hit")
		hits++
		if !skill && hits >= 1 {
			break
		}
	}
	for _, t := range g.Heroes {
		if t.Owner == h.Owner || t.HP <= 0 || dist(h.X, h.Z, t.X, t.Z) > r {
			continue
		}
		a := math.Atan2(t.X-h.X, t.Z-h.Z)
		if math.Abs(angle(a-h.Facing)) <= arc {
			before := t.HP
			blocked := t.Block && t.Stamina >= 5 && math.Abs(angle(math.Atan2(h.X-t.X, h.Z-t.Z)-t.Facing)) < 1.5
			g.damageHero(t, damage, h.X, h.Z)
			if t.HP < before {
				kind := "hit"
				if blocked {
					kind = "block"
				}
				g.heroImpact(h, t.X, t.Z, before-t.HP, kind)
			}
		}
	}
	for _, b := range g.Bases {
		if b.Stage == "active" && b.Owner != h.Owner && dist(h.X, h.Z, b.X, b.Z) < r+6 {
			a := math.Atan2(b.X-h.X, b.Z-h.Z)
			if math.Abs(angle(a-h.Facing)) < arc {
				before := b.HP
				b.HP = math.Max(0, b.HP-damage*0.6)
				g.heroImpact(h, b.X, b.Z, before-b.HP, "hit")
				if b.HP == 0 {
					b.Owner = -1
					b.Stage = "ruined"
					b.Captor = -1
					b.Progress = 0
				}
			}
		}
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
