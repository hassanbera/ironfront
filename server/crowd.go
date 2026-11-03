package main

import "math"

// Lightweight circles, not rigid bodies. One reusable 3 m grid per room keeps
// separation and hero collision local instead of testing every pair of soldiers.
const crowdGridN = 64
const heroRadius = .65

type SoldierBody struct {
	Key, Slot, Next    int
	Squad              *Squad
	X, Z, Radius       float64
	assaultX, assaultZ float64
	Ready              bool
}

func formationOffset(shape string, i int) (float64, float64) {
	row, col := float64(i/5), float64(i%5)
	switch shape {
	case "wedge":
		r := math.Floor(math.Sqrt(float64(i)))
		return (float64(i) - r*r - r) * 1.35, r*1.45 - 3
	case "circle":
		if i == 0 {
			return 0, 0
		}
		n, r, start := 8., 2.1, 1
		if i > 8 {
			n, r, start = 16, 4.2, 9
		}
		a := float64(i-start) / n * math.Pi * 2
		return math.Sin(a) * r, math.Cos(a) * r
	case "crescent":
		a := col / 4 * math.Pi
		return math.Cos(a) * (4 + row*.75), math.Sin(a)*(4+row*.75) - 4
	case "loose":
		return (col-2)*2.25 + float64(i/5%2)*.7, (row - 2) * 2.25
	case "line":
		return float64(i%9-4) * 1.3, float64(i/9-1) * 1.35
	default:
		return (col - 2) * 1.35, (row - 2) * 1.15
	}
}

// Slots survive casualties: killing slot 3 does not rename soldiers 4..24.
func syncSlots(s *Squad, casualty int) {
	if len(s.Slots) > s.Alive && casualty >= 0 {
		for i, id := range s.Slots {
			if id == casualty {
				s.Slots = append(s.Slots[:i], s.Slots[i+1:]...)
				s.Bodies[id].Ready = false
				break
			}
		}
	}
	for len(s.Slots) > s.Alive {
		i := len(s.Slots) - 1
		s.Bodies[s.Slots[i]].Ready = false
		s.Slots = s.Slots[:i]
	}
	var used uint32
	for _, i := range s.Slots {
		used |= 1 << i
	}
	for i := 0; len(s.Slots) < s.Alive && i < 25; i++ {
		if used&(1<<i) == 0 {
			s.Slots = append(s.Slots, i)
			s.Bodies[i].Ready = false
		}
	}
}

func crowdCell(x, z float64) int {
	return max(0, min(63, int((x+96)/3))) + max(0, min(63, int((z+96)/3)))*crowdGridN
}

func (g *Game) rebuildCrowdGrid() {
	if !g.crowdInitialized {
		for i := range g.crowdHeads {
			g.crowdHeads[i] = -1
		}
		g.crowdInitialized = true
	}
	// Only occupied cells need clearing between solver passes.
	for _, cell := range g.crowdCells {
		g.crowdHeads[cell] = -1
		g.crowdOwners[cell] = 0
	}
	g.crowdCells = g.crowdCells[:0]
	for i, b := range g.bodies {
		cell := crowdCell(b.X, b.Z)
		if g.crowdHeads[cell] < 0 {
			g.crowdCells = append(g.crowdCells, cell)
		}
		g.crowdOwners[cell] |= 1 << b.Squad.Owner
		b.Next = g.crowdHeads[cell]
		g.crowdHeads[cell] = i
	}
}

func (g *Game) projectSoldier(b *SoldierBody) {
	b.X = clamp(b.X, -85, 85)
	b.Z = clamp(b.Z, -85, 85)
	for _, o := range g.nav.obstacles {
		dx, dz := b.X-o.X, b.Z-o.Z
		r := o.R + b.Radius
		d2 := dx*dx + dz*dz
		if d2 < r*r {
			if d2 < 1e-8 {
				dx = 1
				dz = 0
				d2 = 1
			}
			k := r / math.Sqrt(d2)
			b.X = o.X + dx*k
			b.Z = o.Z + dz*k
		}
	}
	for _, h := range g.Heroes {
		if h.HP <= 0 {
			continue
		}
		dx, dz := b.X-h.X, b.Z-h.Z
		r := b.Radius + heroRadius + .03
		d2 := dx*dx + dz*dz
		if d2 < r*r {
			if d2 < 1e-8 {
				dx = 1
				dz = 0
				d2 = 1
			}
			k := r / math.Sqrt(d2)
			b.X = h.X + dx*k
			b.Z = h.Z + dz*k
		}
	}
}

func (g *Game) stepCrowd(dt float64) {
	first := len(g.bodies) == 0
	g.bodies = g.bodies[:0]
	for _, s := range g.Squads {
		syncSlots(s, -1)
		spec := g.spec(s)
		shape := g.formation(s).Shape
		scale, r := 1., .54
		if mounted(spec.Kind) {
			scale, r = 1.9, 1.05
		}
		sn, cs := math.Sin(s.Facing), math.Cos(s.Facing)
		maxStep := spec.Speed * dt * 1.4
		for _, slot := range s.Slots {
			ox, oz := formationOffset(shape, slot)
			ox *= scale
			oz *= scale
			x, z := s.X+ox*cs+oz*sn, s.Z-ox*sn+oz*cs
			b := &s.Bodies[slot]
			if s.MeleeTarget != 0 && b.Ready {
				x, z = b.assaultX, b.assaultZ
			}
			b.Key = s.ID*32 + slot
			b.Slot = slot
			b.Squad = s
			b.Radius = r
			if !b.Ready {
				b.X = x
				b.Z = z
				b.Ready = true
			} else {
				dx, dz := (x-b.X)*math.Min(1, dt*7), (z-b.Z)*math.Min(1, dt*7)
				if d := math.Hypot(dx, dz); d > maxStep {
					dx *= maxStep / d
					dz *= maxStep / d
				}
				b.X += dx
				b.Z += dz
			}
			g.projectSoldier(b)
			g.bodies = append(g.bodies, b)
		}
	}
	passes := 5
	if first {
		passes = 24
	}
	for pass := 0; pass < passes; pass++ {
		g.rebuildCrowdGrid()
		for i, a := range g.bodies {
			cell := crowdCell(a.X, a.Z)
			cx, cz := cell%crowdGridN, cell/crowdGridN
			for z := max(0, cz-1); z <= min(crowdGridN-1, cz+1); z++ {
				for x := max(0, cx-1); x <= min(crowdGridN-1, cx+1); x++ {
					for j := g.crowdHeads[x+z*crowdGridN]; j >= 0; j = g.bodies[j].Next {
						if j <= i {
							continue
						}
						b := g.bodies[j]
						dx, dz := b.X-a.X, b.Z-a.Z
						rr := a.Radius + b.Radius + .025
						d2 := dx*dx + dz*dz
						if d2 >= rr*rr {
							continue
						}
						if d2 < 1e-9 {
							dx = .001
							dz = .001 * float64(1+(a.Key+b.Key)%3)
							d2 = dx*dx + dz*dz
						}
						d := math.Sqrt(d2)
						k := (rr - d) * .5 / d
						a.X -= dx * k
						a.Z -= dz * k
						b.X += dx * k
						b.Z += dz * k
					}
				}
			}
		}
		for _, b := range g.bodies {
			g.projectSoldier(b)
		}
	}
	g.rebuildCrowdGrid()
}

func (g *Game) crowdSnapshot() {
	g.Crowd = g.Crowd[:0]
	for _, s := range g.Squads {
		syncSlots(s, -1)
		for _, slot := range s.Slots {
			b := &s.Bodies[slot]
			if b.Ready {
				g.Crowd = append(g.Crowd, [3]int{b.Key, int(math.Round(b.X * 100)), int(math.Round(b.Z * 100))})
			}
		}
	}
}

func (g *Game) heroSpace(h *Hero, x, z float64) bool {
	if !g.nav.walkable(x, z, heroRadius) {
		return false
	}
	cell := crowdCell(x, z)
	cx, cz := cell%crowdGridN, cell/crowdGridN
	if len(g.bodies) > 0 {
		for zz := max(0, cz-1); zz <= min(crowdGridN-1, cz+1); zz++ {
			for xx := max(0, cx-1); xx <= min(crowdGridN-1, cx+1); xx++ {
				for i := g.crowdHeads[xx+zz*crowdGridN]; i >= 0; i = g.bodies[i].Next {
					b := g.bodies[i]
					if !b.Ready || b.Squad.Alive == 0 {
						continue
					}
					r := heroRadius + b.Radius
					if (x-b.X)*(x-b.X)+(z-b.Z)*(z-b.Z) < r*r {
						return false
					}
				}
			}
		}
	}
	for _, other := range g.Heroes {
		if other != h && other.HP > 0 && dist(x, z, other.X, other.Z) < heroRadius*2 {
			return false
		}
	}
	return true
}

func (g *Game) moveHeroBody(h *Hero, dx, dz float64) {
	// Substeps prevent a fast dodge from skipping a thin infantry line.
	steps := max(1, int(math.Ceil(math.Hypot(dx, dz)/.25)))
	dx /= float64(steps)
	dz /= float64(steps)
	for i := 0; i < steps; i++ {
		if g.heroSpace(h, h.X+dx, h.Z+dz) {
			h.X += dx
			h.Z += dz
			continue
		}
		if g.heroSpace(h, h.X+dx, h.Z) {
			h.X += dx
		}
		if g.heroSpace(h, h.X, h.Z+dz) {
			h.Z += dz
		}
	}
}
