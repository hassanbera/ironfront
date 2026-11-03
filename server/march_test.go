package main

import (
	"math"
	"testing"
)

func TestStrategicOpening(t *testing.T) {
	for mapID := range rules.Maps {
		if rules.Maps[mapID].Size != fieldSize {
			t.Fatal("map and navigation bounds differ", mapID)
		}
		for owner := 0; owner < 4; owner++ {
			for _, destination := range []string{"outpost", "rival"} {
				g := battle(t, mapID)
				g.Players[owner].Faction = 0
				s := g.Squads[4*owner+3]
				g.Squads = []*Squad{s}
				post := g.Outposts[owner]
				x, z := post.X, post.Z
				if destination == "rival" {
					base := g.Bases[owner^1]
					dx, dz := s.X-base.X, s.Z-base.Z
					d := math.Hypot(dx, dz)
					x, z = base.X+dx*16/d, base.Z+dz*16/d
				}
				if err := g.command(owner, Command{Type: "order", Order: "move", IDs: []int{s.ID}, X: x, Z: z}); err != nil {
					t.Fatal(err)
				}
				arrival := 0.
				for g.Time < 850 && dist(s.X, s.Z, x, z) > 1 {
					g.Time += .05
					g.moveSquads(.05)
					if arrival == 0 && dist(s.X, s.Z, x, z) <= 12 {
						arrival = g.Time
					}
				}
				if dist(s.X, s.Z, x, z) > 1 {
					t.Fatalf("unreachable map=%d owner=%d %s at %.1f %.1f", mapID, owner, destination, s.X, s.Z)
				}
				t.Logf("map=%d owner=%d goal=%s enter=%.1f center=%.1f", mapID, owner, destination, arrival, g.Time)
				if destination == "outpost" && (arrival < 120 || g.Time > 180) {
					t.Fatal("first outpost must take two to three minutes")
				}
			}
		}
	}
}

func TestRouteAvoidsRockBetweenGridPoints(t *testing.T) {
	n := NewNav(MapSpec{Obstacles: []Obstacle{{X: 0, Z: 6, R: 1}}})
	start, end := Vec{-30, 6}, Vec{30, 6}
	path := n.path(start.X, start.Z, end.X, end.Z)
	if len(path) < 2 || path[len(path)-1] != end {
		t.Fatalf("missing detour: %v", path)
	}
	from := start
	for _, to := range path {
		if !n.line(from, to) {
			t.Fatalf("coarse grid cuts through rock: %v -> %v", from, to)
		}
		from = to
	}
}
