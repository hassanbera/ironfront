package main

import (
	"fmt"
	"math"
	"testing"
)

// Constant populated arena: casualties are replenished before each tick so
// results cannot improve simply because one implementation kills units sooner.
func BenchmarkPopulatedBattle(b *testing.B) {
	for _, count := range []int{400, 800} {
		b.Run(fmt.Sprint(count), func(b *testing.B) {
			g := NewGame("PERF", 0, 0)
			g.Players[0] = &Player{ID: 0, Faction: 0}
			g.start(true)
			for _, p := range g.Players {
				p.Bot = false
			}
			for len(g.Squads)*25 < count {
				g.addSquad(len(g.Squads)%4, len(g.Squads)%4, false)
			}
			g.nav = &Nav{}
			g.Heroes, g.Bases = nil, nil
			for i, s := range g.Squads {
				s.X = float64(i/4%4)*13 - 20
				s.Z = float64(i%4)*5 - 8 + float64(i/16)*27
				s.Facing = 0
				if i%4 >= 2 {
					s.Facing = math.Pi
				}
				s.Order = "hold"
				s.Bodies = [25]SoldierBody{}
			}
			g.bodies = nil
			g.stepCrowd(.05)
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				for _, s := range g.Squads {
					s.Alive = 25
					s.HP = g.spec(s).HP * 25
					s.Missing = s.Missing[:0]
				}
				g.step(.05)
				if g.Time > 1000 {
					g.Time = 0
				}
			}
		})
	}
}
