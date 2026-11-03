package main

import (
	"math"
	"sort"
)

// Give neighbors adjacent lanes around the enemy. Sorting once per formation
// keeps the leading ranks in front and the outside files on their own flank.
var assaultLanes = func() map[string][25]float64 {
	lanes := map[string][25]float64{}
	for _, shape := range []string{"wedge", "wall", "line", "circle", "loose", "crescent"} {
		ids := [25]int{}
		for i := range ids {
			ids[i] = i
		}
		sort.SliceStable(ids[:], func(i, j int) bool {
			x, z := formationOffset(shape, ids[i])
			xx, zz := formationOffset(shape, ids[j])
			return x+.08*z < xx+.08*zz
		})
		var arc [25]float64
		for i, slot := range ids {
			arc[slot] = float64(i-12) * .229
		}
		lanes[shape] = arc
	}
	return lanes
}()

func (g *Game) pressAttack(s, enemy *Squad, base *Base, previous int) {
	var cx, cz, radius float64
	if enemy != nil {
		s.MeleeTarget = enemy.ID
		cx, cz = enemy.X, enemy.Z
		radius = 4.3
		if mounted(g.spec(enemy).Kind) {
			radius *= 1.9
		}
	} else {
		s.MeleeTarget = 1000 + base.ID
		cx, cz = base.X, base.Z
		radius = 9.2
	}
	s.Engaged = true
	s.aimCenterX, s.aimCenterZ = cx, cz
	if s.MeleeTarget == previous && g.Time < s.nextLanes {
		return
	}
	s.nextLanes = g.Time + .35
	heading := math.Atan2(s.X-cx, s.Z-cz)
	lanes := assaultLanes[g.formation(s).Shape]
	reach := weaponReach(g.spec(s).Kind)
	for _, slot := range s.Slots {
		b := &s.Bodies[slot]
		a := heading - lanes[slot]
		dx, dz := math.Sin(a), math.Cos(a)
		tx, tz := cx+dx*radius, cz+dz*radius
		margin := b.Radius + reach*.48
		if enemy != nil {
			best := math.MaxFloat64
			var foe *SoldierBody
			for _, id := range enemy.Slots {
				e := &enemy.Bodies[id]
				if !e.Ready {
					continue
				}
				x, z := e.X-tx, e.Z-tz
				if d := x*x + z*z; d < best {
					best, foe = d, e
				}
			}
			if foe != nil {
				tx, tz = foe.X, foe.Z
				margin += foe.Radius
			}
		}
		tx += dx * margin
		tz += dz * margin
		// Horse bodies occupy roughly twice the frontage of infantry. Files
		// that have made their pass peel out, leaving room for the next file.
		if enemy != nil && mounted(g.spec(s).Kind) && !mounted(g.spec(enemy).Kind) &&
			(int(math.Round(lanes[slot]/.229))+12+int(g.Time/4))%3 == 0 {
			tx += dx * 3.8
			tz += dz * 3.8
		}
		// Walk around an occupied front instead of pushing through it to the rear.
		current := math.Atan2(b.X-cx, b.Z-cz)
		delta := angle(a - current)
		if math.Abs(delta) > .70 {
			next := current + math.Copysign(.57, delta)
			tx, tz = cx+math.Sin(next)*(radius+margin+.5), cz+math.Cos(next)*(radius+margin+.5)
		}
		if g.nav.clearShot(b.X, b.Z, tx, tz) {
			b.assaultX, b.assaultZ = tx, tz
		} else {
			b.assaultX, b.assaultZ = b.X, b.Z
		}
	}
}

func (g *Game) fightingDirection(s *Squad, b *SoldierBody, sn, cs float64) (float64, float64) {
	if s.MeleeTarget == 0 || g.Time < s.Notice {
		return sn, cs
	}
	dx, dz := s.aimCenterX-b.X, s.aimCenterZ-b.Z
	if d := math.Hypot(dx, dz); d > .1 {
		return dx / d, dz / d
	}
	return sn, cs
}
