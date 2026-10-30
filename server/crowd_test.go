package main

import (
	"encoding/json"
	"math"
	"testing"
)

func crowdFixture(t *testing.T) *Game {
	t.Helper()
	g := battle(t, 0)
	g.nav = &Nav{}
	g.Heroes = nil
	g.Bases = nil
	g.Squads = []*Squad{g.Squads[2], g.Squads[5]}
	g.bodies = nil
	for _, s := range g.Squads {
		s.X = 0
		s.Z = 0
		s.Facing = 0
		s.Formation = 0
		s.Bodies = [25]SoldierBody{}
	}
	return g
}

func maxOverlap(g *Game) float64 {
	worst := 0.
	for i, a := range g.bodies {
		for _, b := range g.bodies[i+1:] {
			worst = math.Max(worst, a.Radius+b.Radius-dist(a.X, a.Z, b.X, b.Z))
		}
	}
	return worst
}

func TestCrowdSeparationAndSettling(t *testing.T) {
	g := crowdFixture(t)
	// Two overlapping infantry formations must settle without oscillating or sharing bodies.
	for i := 0; i < 160; i++ {
		g.stepCrowd(.05)
	}
	if overlap := maxOverlap(g); overlap > .12 {
		t.Fatalf("overlap %.3f m", overlap)
	}
	previous := make([]Vec, len(g.bodies))
	for i, b := range g.bodies {
		previous[i] = Vec{b.X, b.Z}
	}
	g.stepCrowd(.05)
	for i, b := range g.bodies {
		if d := dist(b.X, b.Z, previous[i].X, previous[i].Z); d > .08 {
			t.Fatalf("idle crowd jitter %.3f m/tick", d)
		}
	}
	// Move the formation goals through each other, including a hero in their path.
	h := &Hero{Owner: 0, X: 0, Z: 0, HP: 100}
	g.Heroes = []*Hero{h}
	for i := 0; i < 80; i++ {
		g.Squads[0].X = -4 + float64(i)*.1
		g.Squads[1].X = 4 - float64(i)*.1
		g.stepCrowd(.05)
		if overlap := maxOverlap(g); overlap > .22 {
			t.Fatalf("moving overlap %.3f m at tick %d", overlap, i)
		}
		for _, b := range g.bodies {
			if dist(b.X, b.Z, h.X, h.Z) < b.Radius+heroRadius-.001 {
				t.Fatal("soldier entered hero")
			}
		}
	}
}

func TestHeroSweptCrowdCollisionAndSlide(t *testing.T) {
	g := crowdFixture(t)
	s := g.Squads[0]
	s.Alive = 1
	s.Slots = []int{0}
	b := &s.Bodies[0]
	*b = SoldierBody{Key: s.ID * 32, Slot: 0, Squad: s, X: 0, Z: 0, Radius: .54, Ready: true}
	g.bodies = []*SoldierBody{b}
	g.rebuildCrowdGrid()
	h := &Hero{Owner: 0, X: 0, Z: -3, HP: 100}
	g.Heroes = []*Hero{h}
	g.moveHeroBody(h, 0, 8)
	if h.Z > -(heroRadius + b.Radius) {
		t.Fatalf("dodge tunneled through soldier: z=%f", h.Z)
	}
	beforeX := h.X
	g.moveHeroBody(h, 1, 1)
	if h.X <= beforeX || dist(h.X, h.Z, b.X, b.Z) < heroRadius+b.Radius {
		t.Fatal("diagonal movement must slide without entering body")
	}
	b.Ready = false
	h.X = 0
	h.Z = -3
	g.moveHeroBody(h, 0, 8)
	if math.Abs(h.Z-5) > .001 {
		t.Fatal("removed soldier still blocks movement")
	}
	g.bodies = nil
	g.nav.obstacles = []Obstacle{{X: 0, Z: 0, R: 2}}
	h.X = 0
	h.Z = -4
	g.moveHeroBody(h, 0, 10)
	if h.Z > -2-heroRadius {
		t.Fatal("dodge tunneled through map obstacle")
	}
}

func TestHeroHitsVisibleSoldierAndKeepsSurvivorIdentity(t *testing.T) {
	g := crowdFixture(t)
	g.Time = 10
	s := g.Squads[1]
	s.Alive = 2
	s.Slots = []int{3, 7}
	s.HP = g.spec(s).HP + 1
	s.X = 40
	s.Z = 40
	g.Squads = []*Squad{s}
	for i, slot := range s.Slots {
		s.Bodies[slot] = SoldierBody{Key: s.ID*32 + slot, Slot: slot, Squad: s, X: 0, Z: 3 + float64(i)*.7, Radius: .54, Ready: true}
	}
	h := &Hero{Owner: 0, Class: 0, HP: 100, Facing: 0}
	g.Heroes = []*Hero{h}
	g.resolveHeroStrike(h, false)
	if len(h.HitTargets) != 1 || h.HitTargets[0].ID != s.ID || h.HitTargets[0].Slot != 3 || h.HitTargets[0].Z != 3 {
		t.Fatalf("wrong visible contact: %+v", h.HitTargets)
	}
	if s.Alive != 1 || len(s.Slots) != 1 || s.Slots[0] != 7 || s.Bodies[3].Ready {
		t.Fatalf("wrong casualty/survivor: %v", s.Slots)
	}
	g.crowdSnapshot()
	if len(g.Crowd) != 1 || g.Crowd[0][0] != s.ID*32+7 {
		t.Fatalf("snapshot renamed survivor: %v", g.Crowd)
	}
	s.Alive = 2
	syncSlots(s, -1)
	if s.Slots[0] != 7 || s.Slots[1] != 0 || s.Bodies[0].Ready {
		t.Fatal("reinforcement must fill free slot, retain survivors and await placement")
	}
	// A miss must not repeat stale target feedback.
	h.Facing = math.Pi
	g.resolveHeroStrike(h, false)
	if len(h.HitTargets) != 0 {
		t.Fatal("miss repeated previous hit")
	}
}

func TestCrowdSnapshotBudget(t *testing.T) {
	g := battle(t, 0)
	g.crowdSnapshot()
	if len(g.Crowd) != 400 {
		t.Fatalf("want 400 bodies, got %d", len(g.Crowd))
	}
	data, err := json.Marshal(g)
	if err != nil {
		t.Fatal(err)
	}
	if len(data) > 40000 {
		t.Fatalf("snapshot exceeded 40 KB budget: %d", len(data))
	}
	t.Logf("400-soldier full snapshot: %d bytes", len(data))
}

func TestCrowdDoesNotTeleportToDistantFormation(t *testing.T) {
	g := crowdFixture(t)
	g.Squads = g.Squads[:1]
	s := g.Squads[0]
	s.Alive = 1
	g.stepCrowd(.05)
	b := g.bodies[0]
	x, z := b.X, b.Z
	s.X += 60
	g.stepCrowd(.05)
	if dist(b.X, b.Z, x, z) > g.spec(s).Speed*.05*1.4+.001 {
		t.Fatal("living soldier teleported to a distant formation goal")
	}
}

func BenchmarkCrowd400(b *testing.B) {
	g := NewGame("BENCH", 0, 0)
	g.Players[0] = &Player{ID: 0, Faction: 0, MainBase: 0}
	if err := g.start(true); err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		g.stepCrowd(.05)
		g.crowdSnapshot()
	}
}
