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
