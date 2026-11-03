package main

import "testing"

func TestMarchToHomeOutpost(t *testing.T) {
	for m := range rules.Maps {
		if rules.Maps[m].Size != fieldSize {
			t.Fatal("map and navigation bounds differ", m)
		}
		g := battle(t, m)
		s := g.Squads[3]
		o := g.Outposts[0]
		g.Squads = []*Squad{s}
		if err := g.command(s.Owner, Command{Type: "order", Order: "move", IDs: []int{s.ID}, X: o.X, Z: o.Z}); err != nil {
			t.Fatal(err)
		}
		for g.Time < 120 && dist(s.X, s.Z, o.X, o.Z) > 1 {
			g.Time += .05
			g.moveSquads(.05)
		}
		if dist(s.X, s.Z, o.X, o.Z) > 1 {
			t.Fatal("unreachable outpost", m)
		}
		t.Logf("map=%d march=%.2fs", m, g.Time)
		if g.Time < 17 || g.Time > 26 {
			t.Fatal("home post travel time outside design window")
		}
	}
}
