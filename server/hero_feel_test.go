package main

import (
	"math"
	"testing"
)

func heroDuel(t *testing.T) (*Game, *Hero, *Hero) {
	g := battle(t, 0)
	g.Time = 10
	g.Squads = nil
	a, b := g.Heroes[0], g.Heroes[1]
	g.Heroes = []*Hero{a, b}
	a.X, a.Z, a.Facing, a.Active, a.InputAt = 0, 50, 0, true, g.Time
	b.X, b.Z, b.Facing, b.Active, b.InputAt = 0, 53, math.Pi, true, g.Time
	a.Input = HeroInput{Facing: 0}
	b.Input = HeroInput{Facing: math.Pi}
	return g, a, b
}

func TestHeroWindupImpactAndMiss(t *testing.T) {
	g, a, b := heroDuel(t)
	hp := b.HP
	g.heroAction(a.Owner, "attack")
	if b.HP != hp || a.PendingStrike <= g.Time {
		t.Fatal("attack must wind up before damage")
	}
	g.Time = a.AttackImpact - .001
	g.moveHeroes(0)
	if b.HP != hp {
		t.Fatal("damage before contact")
	}
	g.Time = a.AttackImpact + .001
	g.moveHeroes(0)
	if b.HP >= hp || a.ImpactAt != g.Time || a.ImpactDamage != hp-b.HP {
		t.Fatal("missing confirmed contact")
	}
	hp = b.HP
	g.moveHeroes(0)
	if b.HP != hp {
		t.Fatal("contact resolved twice")
	}
	g.Time = a.AttackReady + .01
	a.Input.Facing = math.Pi
	a.Facing = math.Pi
	previous := a.ImpactAt
	g.heroAction(a.Owner, "attack")
	g.Time = a.AttackImpact + .001
	g.moveHeroes(0)
	if b.HP != hp || a.ImpactAt != previous {
		t.Fatal("miss reported as hit")
	}
}

func TestHeroDodgeKeepsCommittedDirection(t *testing.T) {
	g, a, _ := heroDuel(t)
	a.Input.X = -1
	g.heroAction(a.Owner, "dodge")
	a.Input = HeroInput{X: 1, Facing: 0}
	before := a.X
	g.moveHeroes(.05)
	if a.X >= before || a.DodgeX != -1 {
		t.Fatal("later input reversed dodge")
	}
	g.Time = a.DodgeUntil + .01
	a.InputAt = g.Time
	before = a.X
	g.moveHeroes(.05)
	if a.X <= before {
		t.Fatal("movement did not resume after dodge")
	}
	g.Time = a.DodgeReady + .01
	a.Input = HeroInput{Facing: math.Pi / 2}
	a.Stamina = 100
	g.heroAction(a.Owner, "dodge")
	if math.Abs(a.DodgeX+1) > .001 || math.Abs(a.DodgeZ) > .001 {
		t.Fatal("stationary dodge must backstep relative to aim")
	}
}

func TestHeroWindupCancellationAndBlockedFeedback(t *testing.T) {
	for _, cancel := range []string{"dodge", "block", "death"} {
		g, a, b := heroDuel(t)
		hp := b.HP
		g.heroAction(a.Owner, "attack")
		impact := a.AttackImpact
		switch cancel {
		case "dodge":
			g.heroAction(a.Owner, "dodge")
		case "block":
			a.Input.Block = true
			g.moveHeroes(0)
		case "death":
			g.damageHero(a, 10000, a.X, a.Z-1)
		}
		g.Time = impact + .001
		g.moveHeroes(0)
		if b.HP != hp || a.PendingStrike != 0 {
			t.Fatalf("%s failed to cancel pending strike", cancel)
		}
	}
	g, a, b := heroDuel(t)
	b.Input.Block = true
	b.InputAt = 20
	g.heroAction(a.Owner, "attack")
	g.moveHeroes(0)
	g.Time = a.AttackImpact + .001
	g.moveHeroes(0)
	if a.ImpactKind != "block" || b.BlockAt != g.Time {
		t.Fatal("blocked contact feedback missing")
	}
}
