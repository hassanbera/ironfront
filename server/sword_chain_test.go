package main

import (
	"math"
	"testing"
)

func TestSwordChainBufferedCuts(t *testing.T) {
	g, a, b := heroDuel(t)
	for step, beat := range rules.SwordChain.Steps {
		if step == 0 {
			g.heroAction(a.Owner, "attack")
		}
		if !a.SwordChain || a.AttackKind != step || math.Abs(a.AttackDuration-beat.Duration) > 1e-6 {
			t.Fatalf("unexpected beat %d: kind=%d duration=%f", step, a.AttackKind, a.AttackDuration)
		}
		hp := b.HP
		g.Time = a.AttackAt + a.AttackDuration*.30
		g.heroAction(a.Owner, "attack")
		g.heroAction(a.Owner, "attack")
		g.moveHeroes(0)
		if b.HP != hp {
			t.Fatal("early contact")
		}
		g.Time = a.AttackImpact + .001
		g.moveHeroes(0)
		after := b.HP
		g.moveHeroes(0)
		if after >= hp || b.HP != after {
			t.Fatal("beat did not hit exactly once")
		}
		g.Time = a.AttackAt + a.AttackDuration + .001
		if step == 2 {
			g.heroAction(a.Owner, "attack")
			if a.queuedCut || a.AttackReady <= g.Time {
				t.Fatal("finisher lost its recovery")
			}
		}
		g.moveHeroes(0)
	}
	g.Time = a.AttackReady + .01
	g.moveHeroes(0)
	if a.AttackKind != 2 {
		t.Fatal("spurious fourth strike")
	}
	g.heroAction(a.Owner, "attack")
	if a.AttackKind != 0 {
		t.Fatal("next chain did not open on the right")
	}
}

func TestSwordChainBreaks(t *testing.T) {
	for _, cancel := range []string{"timeout", "block", "dodge", "exit", "death"} {
		t.Run(cancel, func(t *testing.T) {
			g, a, _ := heroDuel(t)
			g.heroAction(a.Owner, "attack")
			if cancel != "timeout" {
				g.Time = a.AttackImpact + .001
				g.moveHeroes(0)
				g.heroAction(a.Owner, "attack")
				if !a.queuedCut {
					t.Fatal("expected buffered cut")
				}
			}
			switch cancel {
			case "block":
				a.Input.Block = true
				a.InputAt = g.Time
				g.moveHeroes(0)
				a.Input.Block = false
			case "dodge":
				g.heroAction(a.Owner, "dodge")
			case "exit":
				g.command(a.Owner, Command{Type: "hero", Active: false})
				g.command(a.Owner, Command{Type: "hero", Active: true})
			case "death":
				g.damageHero(a, 10000, a.X, a.Z-1)
				a.HP = 100
			}
			g.Time = a.AttackReady + rules.SwordChain.LinkWindow + .01
			g.moveHeroes(0)
			if a.queuedCut || a.AttackKind != 0 {
				t.Fatal("interruption leaked a follow-up")
			}
			g.heroAction(a.Owner, "attack")
			if !a.SwordChain || a.AttackKind != 0 {
				t.Fatal("fresh tap must start a new chain")
			}
		})
	}
}
