package main

import (
	"math"
	"testing"
)

func resolveMeleeExchange(g *Game) {
	g.combat()
	g.Time += rules.Combat.MeleeDuration*rules.Combat.ImpactFraction + .001
	g.combat()
}
func TestImpactsCoalesceUntilSnapshot(t *testing.T) {
	g, a, b := contactFixture(t)
	g.resolveContact(unitContact{from: &a.Bodies[0], to: &b.Bodies[0]}, .1)
	g.Time += .05
	g.resolveContact(unitContact{from: &a.Bodies[0], to: &b.Bodies[1]}, .1)
	if b.HitSlots != 3 {
		t.Fatal("first impact lost between snapshots")
	}
	g.hitEpoch++ // server has serialized the current snapshot
	g.Time += .05
	g.resolveContact(unitContact{from: &a.Bodies[0], to: &b.Bodies[1]}, .1)
	if b.HitSlots != 2 {
		t.Fatal("previous snapshot's impact replayed")
	}
}
func TestUnitWindupImpactAndCompleteRecovery(t *testing.T) {
	g, a, b := contactFixture(t)
	before := b.HP
	g.combat()
	start, impact := a.AttackAt, a.AttackImpact
	if b.HP != before || impact <= start {
		t.Fatal("damage before windup")
	}
	g.Time = impact - .001
	g.combat()
	if b.HP != before {
		t.Fatal("early impact")
	}
	g.Time = impact + .001
	g.combat()
	if b.HP >= before {
		t.Fatal("missing contact damage")
	}
	hp := b.HP
	g.combat()
	if b.HP != hp {
		t.Fatal("impact resolved twice")
	}
	g.Time = start + rules.Combat.MeleeCycle - .001
	g.combat()
	if a.AttackAt != start {
		t.Fatal("attack restarted during recovery")
	}
	g.Time = start + rules.Combat.MeleeCycle
	g.combat()
	if a.AttackAt < start+a.AttackDuration {
		t.Fatal("animation reset before it could finish")
	}
}
func TestWindupRechecksTargetAndCancelsOrders(t *testing.T) {
	for _, mode := range []string{"escape", "wall", "casualty", "retreat"} {
		g, a, b := contactFixture(t)
		before := b.HP
		g.combat()
		switch mode {
		case "escape":
			b.Bodies[0].Z = 20
		case "wall":
			g.nav.obstacles = []Obstacle{{X: 0, Z: 1, R: .3}}
		case "casualty":
			a.Bodies[0].Ready = false
		case "retreat":
			a.Order = "retreat"
		}
		g.Time = a.AttackImpact + .001
		g.combat()
		if b.HP != before {
			t.Errorf("%s failed to cancel impact", mode)
		}
	}
}
func rangedFixture(t *testing.T) (*Game, *Squad, *Squad) {
	g, a, b := contactFixture(t)
	a.Class = 1
	a.Alive, b.Alive = 1, 1
	a.HP, b.HP = g.spec(a).HP, g.spec(b).HP
	a.Slots, b.Slots = []int{0}, []int{0}
	b.AttackTimer = 100
	g.bodies = []*SoldierBody{contactBody(a, 0, 0, 0), contactBody(b, 0, 0, 20)}
	g.rebuildCrowdGrid()
	return g, a, b
}
func TestVolleyDamageWaitsForLaunchAndFlight(t *testing.T) {
	g, a, b := rangedFixture(t)
	before := b.HP
	g.combat()
	g.Time = a.AttackImpact - .001
	g.combat()
	if len(g.flights) != 0 || b.HP != before {
		t.Fatal("arrow launched before release pose")
	}
	g.Time = a.AttackImpact + .001
	g.combat()
	if len(g.flights) != 1 || len(a.Volley) != 1 || b.HP != before {
		t.Fatal("launch should not apply damage")
	}
	shot := a.Volley[0]
	if math.Abs(shot.Land-shot.At-20/rules.Combat.ProjectileSpeed) > 1e-8 {
		t.Fatal("flight time not distance based")
	}
	g.Time = shot.Land - .001
	g.combat()
	if b.HP != before {
		t.Fatal("arrow damage before visual arrival")
	}
	g.Time = shot.Land + .001
	g.combat()
	if b.HP >= before || len(g.flights) != 0 {
		t.Fatal("arrow did not resolve at arrival")
	}
	hp := b.HP
	g.combat()
	if b.HP != hp {
		t.Fatal("arrow hit twice")
	}
}
func TestInFlightArrowSurvivesShooterAndRespectsCover(t *testing.T) {
	for _, covered := range []bool{false, true} {
		g, a, b := rangedFixture(t)
		g.combat()
		g.Time = a.AttackImpact + .001
		g.combat()
		land := a.Volley[0].Land
		g.damageSquad(a, 10000, 1, b.ID, "front")
		syncSlots(a, -1)
		if covered {
			g.nav.obstacles = []Obstacle{{X: 0, Z: 10, R: 2}}
		}
		before := b.HP
		g.Time = land + .001
		g.combat()
		if covered && b.HP != before {
			t.Fatal("arrow hit through cover")
		}
		if !covered && b.HP >= before {
			t.Fatal("launched arrow vanished with shooter")
		}
	}
}
func TestArcherHeroGetsConfirmedFeedbackOnlyAtArrival(t *testing.T) {
	g, _, b := rangedFixture(t)
	g.Squads = []*Squad{b}
	h := &Hero{Owner: 0, Class: 2, X: 0, Z: 0, Facing: 0, HP: 220, Active: true}
	g.Heroes = []*Hero{h}
	before := b.HP
	g.heroStrike(h, false)
	g.Time = h.AttackImpact + .001
	g.moveHeroes(0)
	if b.HP != before || len(h.Volley) != 1 || len(h.HitTargets) != 0 {
		t.Fatal("hero arrow damaged at release")
	}
	g.Time = h.Volley[0].Land + .001
	g.combat()
	if b.HP >= before || len(h.HitTargets) != 1 || h.HitTargets[0].ID != b.ID || h.HitTargets[0].Slot != 0 || h.ImpactAt != g.Time {
		t.Fatal("missing precise hero projectile feedback")
	}
}
func TestProjectileFreezesAttackerBonusesAtRelease(t *testing.T) {
	g, a, b := rangedFixture(t)
	a.Owner, a.Class, a.Formation = 3, 0, 0
	a.moving = true
	g.combat()
	g.Time = a.AttackImpact + .001
	g.combat()
	land := a.Volley[0].Land
	a.moving = false
	a.Formation = 1
	before := b.HP
	g.Time = land + .001
	g.combat()
	want := 5.4 * rules.Combat.RangedCycle * .65 * .82 * (1 - .32)
	if math.Abs(before-b.HP-want) > 1e-8 {
		t.Fatalf("in-flight arrow changed offense: got=%f want=%f", before-b.HP, want)
	}
}
func TestProjectileDodgeAtArrival(t *testing.T) {
	g, a, _ := rangedFixture(t)
	g.Squads = []*Squad{a}
	g.bodies = g.bodies[:1]
	g.rebuildCrowdGrid()
	h := &Hero{Owner: 1, X: 0, Z: 20, HP: 360}
	g.Heroes = []*Hero{h}
	g.combat()
	g.Time = a.AttackImpact + .001
	g.combat()
	g.Time = a.Volley[0].Land + .001
	h.DodgeUntil = g.Time + .2
	g.combat()
	if h.HP != 360 {
		t.Fatal("arrival ignored active dodge")
	}
}
