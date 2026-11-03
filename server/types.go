package main

import (
	_ "embed"
	"encoding/json"
	"math"
)

//go:embed rules.json
var rulesJSON []byte

type UnitSpec struct {
	Name, Short, Role, Kind                           string
	HP, Damage, Armor, Speed, Range, Cooldown, Notice float64
}
type FormationSpec struct {
	Name, Shape, Description   string
	Speed, Attack, Front, Rear float64
}
type FactionSpec struct {
	ID                                              int
	Name, Title, Color, Accent, Emblem, Description string
	Units                                           []UnitSpec
	Formations                                      []FormationSpec
}
type HeroSpec struct {
	ID                          int
	Name, Description           string
	HP, Damage, Speed, Cooldown float64
}
type Zone struct {
	X, Z, RX, RZ float64
	Kind         string
}
type Obstacle struct{ X, Z, R float64 }
type MapSpec struct {
	ID                                      int
	Name, Subtitle, Biome, Tag, Description string
	Size                                    float64
	Zones                                   []Zone
	Obstacles                               []Obstacle
}
type Rules struct {
	SwordChain struct {
		Steps                [3]struct{ Duration, Impact float64 }
		Recovery, LinkWindow float64
	}
	Combat   struct{ MeleeCycle, MeleeDuration, RangedCycle, RangedDuration, ImpactFraction, ReleaseFraction, ProjectileSpeed float64 }
	Factions []FactionSpec
	Heroes   []HeroSpec
	Maps     []MapSpec
}

var rules Rules

func init() {
	if err := json.Unmarshal(rulesJSON, &rules); err != nil {
		panic(err)
	}
}

type Vec struct {
	X float64 `json:"x"`
	Z float64 `json:"z"`
}
type Player struct {
	ID         int     `json:"id"`
	Name       string  `json:"name"`
	Faction    int     `json:"faction"`
	HeroClass  int     `json:"heroClass"`
	Connected  bool    `json:"connected"`
	Bot        bool    `json:"bot"`
	Eliminated bool    `json:"eliminated"`
	Capacity   int     `json:"capacity"`
	MainBase   int     `json:"mainBase"`
	Kills      int     `json:"kills"`
	Token      string  `json:"-"`
	LastSeen   float64 `json:"-"`
}
type Squad struct {
	ID                     int          `json:"id"`
	Owner                  int          `json:"owner"`
	Class                  int          `json:"class"`
	Formation              int          `json:"formation"`
	X                      float64      `json:"x"`
	Z                      float64      `json:"z"`
	Facing                 float64      `json:"facing"`
	HP                     float64      `json:"hp"`
	Alive                  int          `json:"alive"`
	TargetX                float64      `json:"targetX"`
	TargetZ                float64      `json:"targetZ"`
	Order                  string       `json:"order"`
	Target                 int          `json:"target"`
	Engaged                bool         `json:"engaged"`
	Notice                 float64      `json:"notice"`
	Respawn                float64      `json:"respawn"`
	Flash                  float64      `json:"flash"`
	AttackAt               float64      `json:"attackAt"`
	AttackSlots            uint32       `json:"attackSlots"`
	HitSlots               uint32       `json:"hitSlots"`
	AttackDuration         float64      `json:"attackDuration,omitempty"`
	AttackImpact           float64      `json:"attackImpact,omitempty"`
	Volley                 []ShotVisual `json:"volley,omitempty"`
	strikes                [25]unitContact
	strikeCount            int
	pendingImpact          float64
	resolvedAt             float64
	hitEpoch               uint64
	moving                 bool
	MeleeTarget            int `json:"meleeTarget,omitempty"`
	nextLanes              float64
	aimCenterX, aimCenterZ float64
	AimX                   float64         `json:"aimX"`
	AimZ                   float64         `json:"aimZ"`
	Flank                  string          `json:"flank"`
	Path                   []Vec           `json:"-"`
	Repath                 float64         `json:"-"`
	AttackTimer            float64         `json:"-"`
	LastAttacker           int             `json:"-"`
	LastHit                float64         `json:"-"`
	Reform                 float64         `json:"-"`
	Missing                []float64       `json:"-"`
	Travel                 float64         `json:"-"`
	Slots                  []int           `json:"slots"`
	Bodies                 [25]SoldierBody `json:"-"`
}
type Base struct {
	ID        int     `json:"id"`
	Owner     int     `json:"owner"`
	X         float64 `json:"x"`
	Z         float64 `json:"z"`
	HP        float64 `json:"hp"`
	Stage     string  `json:"stage"`
	Captor    int     `json:"captor"`
	Progress  float64 `json:"progress"`
	Contested bool    `json:"contested"`
}
type Outpost struct {
	ID        int     `json:"id"`
	Owner     int     `json:"owner"`
	X         float64 `json:"x"`
	Z         float64 `json:"z"`
	Captor    int     `json:"captor"`
	Progress  float64 `json:"progress"`
	Contested bool    `json:"contested"`
}
type Hero struct {
	Owner          int          `json:"owner"`
	Class          int          `json:"class"`
	X              float64      `json:"x"`
	Z              float64      `json:"z"`
	Y              float64      `json:"y"`
	Facing         float64      `json:"facing"`
	HP             float64      `json:"hp"`
	Stamina        float64      `json:"stamina"`
	Active         bool         `json:"active"`
	Block          bool         `json:"block"`
	Respawn        float64      `json:"respawn"`
	AttackAt       float64      `json:"attackAt"`
	AttackKind     int          `json:"attackKind"`
	SwordChain     bool         `json:"swordChain,omitempty"`
	AttackDuration float64      `json:"attackDuration"`
	AttackImpact   float64      `json:"attackImpact"`
	ImpactAt       float64      `json:"impactAt"`
	ImpactX        float64      `json:"impactX"`
	ImpactZ        float64      `json:"impactZ"`
	ImpactDamage   float64      `json:"impactDamage"`
	ImpactKind     string       `json:"impactKind"`
	HitTargets     []HitTarget  `json:"hitTargets,omitempty"`
	Volley         []ShotVisual `json:"volley,omitempty"`
	BlockAt        float64      `json:"blockAt"`
	DodgeUntil     float64      `json:"dodgeUntil"`
	DodgeX         float64      `json:"dodgeX"`
	DodgeZ         float64      `json:"dodgeZ"`
	SkillReady     float64      `json:"skillReady"`
	GuardUntil     float64      `json:"guardUntil"`
	Input          HeroInput    `json:"-"`
	InputAt        float64      `json:"-"`
	AttackReady    float64      `json:"-"`
	DodgeReady     float64      `json:"-"`
	VY             float64      `json:"-"`
	PendingStrike  float64      `json:"-"`
	PendingSkill   bool         `json:"-"`
	hitEpoch       uint64
	Combo          int `json:"-"`
	queuedCut      bool
}
type HeroInput struct {
	X      float64 `json:"x"`
	Z      float64 `json:"z"`
	Facing float64 `json:"facing"`
	Block  bool    `json:"block"`
}
type HitTarget struct {
	Kind    string  `json:"kind"`
	ID      int     `json:"id"`
	Slot    int     `json:"slot"`
	X       float64 `json:"x"`
	Z       float64 `json:"z"`
	Damage  float64 `json:"damage"`
	Blocked bool    `json:"blocked"`
}
type Event struct {
	ID    int     `json:"id"`
	Time  float64 `json:"time"`
	Text  string  `json:"text"`
	Kind  string  `json:"kind"`
	Owner int     `json:"owner"`
}
type Game struct {
	Type             string     `json:"type"`
	Room             string     `json:"room"`
	Phase            string     `json:"phase"`
	Map              int        `json:"map"`
	Time             float64    `json:"time"`
	Host             int        `json:"host"`
	Players          []*Player  `json:"players"`
	Squads           []*Squad   `json:"squads"`
	Bases            []*Base    `json:"bases"`
	Outposts         []*Outpost `json:"outposts"`
	Heroes           []*Hero    `json:"heroes"`
	Events           []Event    `json:"events"`
	Winner           int        `json:"winner"`
	Tick             int64      `json:"tick"`
	nextID           int
	eventID          int
	botAt            float64
	combatAt         float64
	nav              *Nav
	Crowd            [][3]int `json:"crowd,omitempty"`
	bodies           []*SoldierBody
	crowdHeads       [crowdGridN * crowdGridN]int
	crowdOwners      [crowdGridN * crowdGridN]uint8
	crowdCells       []int
	crowdInitialized bool
	contacts         []unitContact
	flights          []battleShot
	hitEpoch         uint64
}
type Command struct {
	Type      string    `json:"type"`
	Room      string    `json:"room"`
	Name      string    `json:"name"`
	Token     string    `json:"token"`
	Faction   int       `json:"faction"`
	HeroClass int       `json:"heroClass"`
	Map       int       `json:"map"`
	Practice  bool      `json:"practice"`
	Bots      bool      `json:"bots"`
	IDs       []int     `json:"ids"`
	Order     string    `json:"order"`
	X         float64   `json:"x"`
	Z         float64   `json:"z"`
	Target    int       `json:"target"`
	Formation int       `json:"formation"`
	Class     int       `json:"class"`
	Active    bool      `json:"active"`
	Input     HeroInput `json:"input"`
	Action    string    `json:"action"`
	Stamp     float64   `json:"stamp"`
}

func clamp(x, a, b float64) float64     { return math.Max(a, math.Min(b, x)) }
func dist(x, z, xx, zz float64) float64 { return math.Hypot(x-xx, z-zz) }
func angle(x float64) float64           { return math.Atan2(math.Sin(x), math.Cos(x)) }
func finite(x float64) bool             { return !math.IsNaN(x) && !math.IsInf(x, 0) }
func mounted(k string) bool {
	return k == "cavalry" || k == "lancer" || k == "horseArcher" || k == "camel"
}
func ranged(k string) bool { return k == "archer" || k == "horseArcher" || k == "javelin" }
func (g *Game) spec(s *Squad) UnitSpec {
	return rules.Factions[g.Players[s.Owner].Faction].Units[s.Class]
}
func (g *Game) formation(s *Squad) FormationSpec {
	return rules.Factions[g.Players[s.Owner].Faction].Formations[s.Formation]
}
func (g *Game) event(owner int, kind, text string) {
	g.eventID++
	g.Events = append(g.Events, Event{g.eventID, g.Time, text, kind, owner})
	if len(g.Events) > 12 {
		g.Events = g.Events[len(g.Events)-12:]
	}
}
func (g *Game) terrain(x, z float64) string {
	kind := "plain"
	for _, v := range rules.Maps[g.Map].Zones {
		if math.Pow((x-v.X)/v.RX, 2)+math.Pow((z-v.Z)/v.RZ, 2) < 1 {
			kind = v.Kind
		}
	}
	return kind
}
