package main

import (
	"math"
	"testing"
)

func TestFormationDirectionalDefense(t *testing.T) {
	g := battle(t, 0)
	// Explicit expected multipliers before armor; also guard existing non-circle balance.
	want := [4][3][3]float64{
		{{1, 1.4, 2.36}, {.68, 1.4, 2.24}, {.92, 1.4, 2.24}},
		{{.82, .82, .82}, {1, 1.4, 2.5}, {1.12, 1.4, 1.8}},
		{{1.08, 1.4, 1.84}, {.86, .86, .86}, {1.15, 1.4, 1.88}},
		{{1.15, 1.4, 1.9}, {1.15, 1.4, 1.8}, {1.08, 1.4, 2.24}},
	}
	for owner := 0; owner < 4; owner++ {
		s := g.Squads[owner*4]
		s.X, s.Z, s.Facing = 0, 0, 0
		for formation := 0; formation < 3; formation++ {
			s.Formation = formation
			for direction, pos := range []Vec{{0, 6}, {6, 0}, {0, -6}} {
				got, _ := g.defenseMultiplier(s, pos.X, pos.Z)
				got /= 1 - g.spec(s).Armor
				if math.Abs(got-want[owner][formation][direction]) > 1e-9 {
					t.Errorf("faction=%d formation=%d direction=%d got=%f want=%f", owner, formation, direction, got, want[owner][formation][direction])
				}
			}
		}
	}
}

func TestHeroRespectsCircleAndArmorFromEveryDirection(t *testing.T) {
	for _, pos := range []Vec{{0, 2}, {2, 0}, {0, -2}} {
		g := crowdFixture(t)
		s := g.Squads[1] // Viking shield infantry in circle.
		g.Squads = []*Squad{s}
		s.Alive, s.HP, s.Slots = 1, 140, []int{0}
		s.Bodies[0] = SoldierBody{X: 0, Z: 0, Radius: .54, Ready: true, Squad: s}
		h := &Hero{Owner: 0, Class: 0, X: pos.X, Z: pos.Z, HP: 360, Facing: math.Atan2(-pos.X, -pos.Z)}
		g.resolveHeroStrike(h, false)
		want := 42 * .82 * (1 - .32)
		if math.Abs(140-s.HP-want) > 1e-8 || len(h.HitTargets) != 1 {
			t.Fatalf("hero ignored all-direction circle/armor at %+v: damage=%f", pos, 140-s.HP)
		}
	}
}

func TestBotFormationUsesPlayerReformCost(t *testing.T) {
	g := battle(t, 0)
	p := g.Players[0]
	p.Bot = true
	s := g.Squads[0]
	s.X, s.Z, s.Formation = -38, 0, 0 // forest
	g.Time = 10
	g.bots()
	if s.Formation != 2 || s.Reform != 11.4 {
		t.Fatalf("bot bypassed reform: formation=%d ready=%f", s.Formation, s.Reform)
	}
	g.Time = 10.5
	g.bots()
	if s.Reform != 11.4 {
		t.Fatal("same formation restarted reform")
	}
}
