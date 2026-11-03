package main

import (
	"math"
	"math/bits"
	"testing"
)

// A stationary, replenished line keeps the same 25 opponents available for
// every formation. Count actual valid contacts at impact, not just swing starts.
func TestAssaultParticipation(t *testing.T) {
	for faction := 0; faction < 4; faction++ {
		for formation := 0; formation < 3; formation++ {
			g := crowdFixture(t)
			a, b := g.Squads[0], g.Squads[1]
			g.Players[a.Owner].Faction = faction
			a.Class = []int{3, 0, 1, 2}[faction]
			b.Class = 1
			a.Formation = formation
			a.Z = -15
			b.Z = 5
			b.Facing = math.Pi
			b.Order = "hold"
			g.stepCrowd(.05)
			if err := g.command(a.Owner, Command{Type: "order", IDs: []int{a.ID}, Order: "attack", Target: b.ID, X: b.X, Z: b.Z}); err != nil {
				t.Fatal(err)
			}
			var hit uint32
			peak := 0
			for tick := 0; tick < 500; tick++ {
				g.Time += .05
				g.moveSquads(.05)
				g.stepCrowd(.05)
				if a.pendingImpact > 0 && a.pendingImpact <= g.Time {
					landed := 0
					for i := 0; i < a.strikeCount; i++ {
						c := &a.strikes[i]
						if c.to != nil && g.contactStillValid(c) {
							b.HP = g.spec(b).HP * 25
							g.resolveContact(*c, c.interval)
							if b.HP >= g.spec(b).HP*25 {
								t.Fatal("contact dealt no damage")
							}
							hit |= 1 << c.from.Slot
							landed++
						}
					}
					peak = max(peak, landed)
					a.pendingImpact = 0
				}
				if g.Time >= a.AttackTimer {
					g.startUnitAttack(a)
				}
			}
			t.Logf("faction=%d formation=%d distinct=%d peak=%d", faction, formation, bits.OnesCount32(hit), peak)
			if bits.OnesCount32(hit) != 25 {
				t.Errorf("assault left soldiers idle: %025b", hit)
			}
			if err := g.command(a.Owner, Command{Type: "order", IDs: []int{a.ID}, Order: "hold"}); err != nil {
				t.Fatal(err)
			}
			g.moveSquads(.05)
			if a.MeleeTarget != 0 || b.MeleeTarget != 0 {
				t.Fatal("defensive order retained assault lanes")
			}
		}
	}
}

func TestMutualAssaultWithCasualties(t *testing.T) {
	g := crowdFixture(t)
	a, b := g.Squads[0], g.Squads[1]
	a.Class, b.Class = 3, 0
	a.Formation, b.Formation = 1, 2
	a.Z, b.Z = -10, 10
	b.Facing = math.Pi
	g.stepCrowd(.05)
	for _, pair := range [][2]*Squad{{a, b}, {b, a}} {
		s, target := pair[0], pair[1]
		if err := g.command(s.Owner, Command{Type: "order", Order: "attack", IDs: []int{s.ID}, Target: target.ID, X: target.X, Z: target.Z}); err != nil {
			t.Fatal(err)
		}
	}
	masks := map[int]uint32{}
	for tick := 0; tick < 600 && a.Alive > 0 && b.Alive > 0; tick++ {
		g.Time += .05
		g.moveSquads(.05)
		g.stepCrowd(.05)
		g.combat()
		for _, c := range g.contacts {
			if c.from != nil && c.to != nil {
				masks[c.from.Squad.ID] |= 1 << c.from.Slot
			}
		}
	}
	for _, s := range g.Squads {
		count := bits.OnesCount32(masks[s.ID])
		t.Logf("squad=%d hit participants=%d survivors=%d", s.ID, count, s.Alive)
		if count < 15 || s.Alive >= 25 {
			t.Fatal("mutual assault did not develop")
		}
	}
}

func TestOrderedVolleyIncludesRearRanks(t *testing.T) {
	for faction, f := range rules.Factions {
		for class, unit := range f.Units {
			if !ranged(unit.Kind) {
				continue
			}
			for form := range f.Formations {
				g := crowdFixture(t)
				a, b := g.Squads[0], g.Squads[1]
				g.Players[a.Owner].Faction = faction
				a.Class, a.Formation = class, form
				a.Z = -48
				b.Z = 8
				b.Facing = math.Pi
				b.Order = "hold"
				g.stepCrowd(.05)
				if err := g.command(a.Owner, Command{Type: "order", Order: "attack", IDs: []int{a.ID}, Target: b.ID, X: b.X, Z: b.Z}); err != nil {
					t.Fatal(err)
				}
				var released uint32
				for tick := 0; tick < 500 && bits.OnesCount32(released) < 25; tick++ {
					g.Time += .05
					g.moveSquads(.05)
					g.stepCrowd(.05)
					if a.pendingImpact > 0 && a.pendingImpact <= g.Time {
						for i := 0; i < a.strikeCount; i++ {
							c := &a.strikes[i]
							if c.to != nil && g.contactStillValid(c) {
								g.launchProjectile(*c)
								released |= 1 << c.from.Slot
							}
						}
						a.pendingImpact = 0
					}
					if g.Time >= a.AttackTimer {
						g.startUnitAttack(a)
					}
				}
				if bits.OnesCount32(released) != 25 {
					t.Errorf("%s formation=%d released=%d/25", unit.Kind, form, bits.OnesCount32(released))
				}
			}
		}
	}
}

func TestContactAroundCoverStartsAssault(t *testing.T) {
	g, a, b := contactFixture(t)
	a.X, a.Z, b.X, b.Z = 0, -3, 0, 3
	a.Order, a.Target = "attack", b.ID
	g.nav.obstacles = []Obstacle{{X: 0, Z: 0, R: .8}}
	contactBody(a, 0, 2, -1)
	contactBody(b, 0, 2, 1)
	g.rebuildCrowdGrid()
	if g.nav.clearShot(a.X, a.Z, b.X, b.Z) {
		t.Fatal("fixture requires occluded squad centers")
	}
	g.moveSquads(.05)
	if a.MeleeTarget != b.ID {
		t.Fatal("actual flank contact was ignored")
	}
}
