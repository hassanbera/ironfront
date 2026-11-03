package main

import (
	"math"
	"testing"
)

func contactBody(s *Squad, slot int, x, z float64) *SoldierBody {
	b := &s.Bodies[slot]
	*b = SoldierBody{Key: s.ID*32 + slot, Slot: slot, Squad: s, X: x, Z: z, Radius: .54, Ready: true}
	return b
}
func contactFixture(t *testing.T) (*Game, *Squad, *Squad) {
	g := crowdFixture(t)
	g.Time = 1
	a, b := g.Squads[0], g.Squads[1]
	a.Class = 3
	a.Facing, b.Facing = 0, math.Pi
	for _, s := range g.Squads {
		s.Alive, s.HP, s.Slots = 2, g.spec(s).HP*2, []int{0, 1}
	}
	g.bodies = []*SoldierBody{contactBody(a, 0, 0, 0), contactBody(a, 1, 0, -10), contactBody(b, 0, 0, 2.1), contactBody(b, 1, 10, 15)}
	g.rebuildCrowdGrid()
	return g, a, b
}
func TestOnlyContactingFrontlineAttacks(t *testing.T) {
	g, a, b := contactFixture(t)
	before := b.HP
	m, _ := g.attackMultiplierAt(a, b, 0, 0, 0, 2.1)
	resolveMeleeExchange(g)
	if a.AttackSlots != 1 || math.Abs(before-b.HP-g.spec(a).Damage*rules.Combat.MeleeCycle*m) > 1e-8 {
		t.Fatalf("rear rank contributed: mask=%b damage=%f", a.AttackSlots, before-b.HP)
	}
	if b.HitSlots != 1 {
		t.Fatalf("wrong impact slots %b", b.HitSlots)
	}
}
func TestSquadCenterCannotDamageDistantHero(t *testing.T) {
	g, a, _ := contactFixture(t)
	g.Squads = []*Squad{a}
	a.X, a.Z = 0, 0
	h := &Hero{Owner: 1, X: 0, Z: 2, HP: 360}
	g.Heroes = []*Hero{h}
	g.bodies = []*SoldierBody{contactBody(a, 0, 40, 40), contactBody(a, 1, 40, 42)}
	g.rebuildCrowdGrid()
	resolveMeleeExchange(g)
	if h.HP != 360 {
		t.Fatal("squad center damaged hero without a nearby body")
	}
	contactBody(a, 0, 0, 0)
	g.rebuildCrowdGrid()
	g.Time += .5
	resolveMeleeExchange(g)
	if math.Abs(360-h.HP-7*rules.Combat.MeleeCycle*1.05) > 1e-8 {
		t.Fatalf("nearby soldier failed to hit hero: %f", h.HP)
	}
}
func TestBodyContactWorksWithDistantSquadCenters(t *testing.T) {
	g, a, b := contactFixture(t)
	a.X, a.Z, b.X, b.Z = -70, -70, 70, 70
	before := b.HP
	resolveMeleeExchange(g)
	if b.HP >= before {
		t.Fatal("visible contact incorrectly rejected by distant centers")
	}
}
func TestContactObstaclesAndForwardCone(t *testing.T) {
	for _, mode := range []string{"wall", "rear", "dead", "move"} {
		g, a, b := contactFixture(t)
		switch mode {
		case "wall":
			g.nav.obstacles = []Obstacle{{X: 0, Z: 1, R: .3}}
		case "rear":
			a.Facing = math.Pi
		case "dead":
			a.Bodies[0].Ready = false
		case "move":
			a.Order = "move"
		}
		before := b.HP
		resolveMeleeExchange(g)
		if b.HP != before {
			t.Errorf("%s incorrectly allowed contact", mode)
		}
	}
	n := &Nav{obstacles: []Obstacle{{X: 0, Z: 2, R: .5}}}
	if n.clearShot(0, 0, 0, 4) || !n.clearShot(.6, 0, .6, 4) {
		t.Fatal("weapon line uses wrong obstacle margin")
	}
}
func TestMeleeContactStopsAdvanceAndKillsStruckSlot(t *testing.T) {
	g, a, b := contactFixture(t)
	if !g.hasMeleeContact(a) {
		t.Fatal("frontline failed to stop advance")
	}
	// Only slot 1 is in reach; total HP permits exactly one casualty.
	contactBody(b, 0, 10, 15)
	contactBody(b, 1, 0, 2.1)
	b.HP = g.spec(b).HP + .1
	g.rebuildCrowdGrid()
	resolveMeleeExchange(g)
	if b.Alive != 1 || b.Slots[0] != 0 || b.Bodies[1].Ready {
		t.Fatal("wrong soldier removed at impact")
	}
}
func TestContactHeroBlockDodgeAndBaseSurface(t *testing.T) {
	for _, mode := range []string{"block", "dodge"} {
		g, a, _ := contactFixture(t)
		g.Squads = []*Squad{a}
		g.bodies = g.bodies[:2]
		g.rebuildCrowdGrid()
		h := &Hero{Owner: 1, X: 0, Z: 2, HP: 360, Facing: math.Pi, Stamina: 100}
		g.Heroes = []*Hero{h}
		want := 7 * rules.Combat.MeleeCycle * 1.05 * .22
		if mode == "block" {
			h.Block = true
		} else {
			h.DodgeUntil = 2
			want = 0
		}
		resolveMeleeExchange(g)
		if math.Abs(360-h.HP-want) > 1e-8 {
			t.Fatalf("%s failed", mode)
		}
	}
	g, a, _ := contactFixture(t)
	g.Squads = []*Squad{a}
	g.bodies = g.bodies[:2]
	contactBody(a, 0, 0, 9.5)
	g.rebuildCrowdGrid()
	b := &Base{ID: 0, Owner: 1, X: 0, Z: 20, HP: 6000, Stage: "active"}
	g.Bases = []*Base{b}
	g.nav.obstacles = []Obstacle{{X: 0, Z: 20, R: 9}}
	a.Order, a.Target = "attack", 1000
	resolveMeleeExchange(g)
	if math.Abs(6000-b.HP-7*rules.Combat.MeleeCycle*1.05*.8) > 1e-8 {
		t.Fatalf("base surface contact failed: hp=%f", b.HP)
	}
}

func TestContactQueryAllocatesNothing(t *testing.T) {
	g, a, _ := contactFixture(t)
	allocs := testing.AllocsPerRun(100, func() { g.contactFor(a, &a.Bodies[0], 1.35, 0, 1) })
	if allocs != 0 {
		t.Fatalf("contact query allocated %f", allocs)
	}
}

func TestCrowdGridClearsVacatedCellsAndOwnerMasks(t *testing.T) {
	g, a, b := contactFixture(t)
	oldCell := crowdCell(b.Bodies[0].X, b.Bodies[0].Z)
	contactBody(b, 0, 60, 60)
	contactBody(b, 1, 65, 65)
	g.rebuildCrowdGrid()
	if g.crowdOwners[oldCell]&(1<<b.Owner) != 0 {
		t.Fatal("stale enemy owner bit")
	}
	if g.hasMeleeContact(a) {
		t.Fatal("stale enemy in vacated cell")
	}
	edge := float64(crowdGridN) * 1.5
	for _, v := range []float64{-1e6, -edge - 3, -edge, -edge + .1, -3, 0, edge - .1, edge, 1e6} {
		want := int(clamp(math.Floor((v+edge)/3), 0, crowdGridN-1))
		if crowdCell(v, 0)%crowdGridN != want {
			t.Fatal("grid clamp changed")
		}
	}
}
