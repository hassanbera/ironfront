package main

import "math"

const fieldSize = 252
const orderLimit = fieldSize/2 - 6
const gridN = fieldSize / 4
const gridOrigin = (fieldSize - gridStep) / 2
const gridStep = 4.0

type Nav struct {
	blocked   [gridN * gridN]bool
	obstacles []Obstacle
}

func NewNav(m MapSpec) *Nav {
	n := &Nav{obstacles: append([]Obstacle(nil), m.Obstacles...)}
	for _, base := range corners {
		n.obstacles = append(n.obstacles, Obstacle{X: base.X, Z: base.Z, R: 9})
	}
	for z := 0; z < gridN; z++ {
		for x := 0; x < gridN; x++ {
			p := gridPoint(x + z*gridN)
			n.blocked[x+z*gridN] = !n.walkable(p.X, p.Z, 3.8)
		}
	}
	return n
}
func gridPoint(i int) Vec {
	return Vec{float64(i%gridN)*gridStep - gridOrigin, float64(i/gridN)*gridStep - gridOrigin}
}
func gridIndex(x, z float64) int {
	return int(clamp(math.Round((x+gridOrigin)/gridStep), 0, gridN-1)) + int(clamp(math.Round((z+gridOrigin)/gridStep), 0, gridN-1))*gridN
}
func (n *Nav) walkable(x, z, margin float64) bool {
	if math.Abs(x) > fieldSize/2-4 || math.Abs(z) > fieldSize/2-4 {
		return false
	}
	for _, o := range n.obstacles {
		if dist(x, z, o.X, o.Z) < o.R+margin {
			return false
		}
	}
	return true
}
func (n *Nav) nearest(x, z float64) int {
	id := gridIndex(x, z)
	if !n.blocked[id] {
		return id
	}
	best := -1
	d := math.MaxFloat64
	for i, b := range n.blocked {
		if b {
			continue
		}
		p := gridPoint(i)
		v := dist(x, z, p.X, p.Z)
		if v < d {
			best = i
			d = v
		}
	}
	return best
}
func (n *Nav) line(a, b Vec) bool {
	d := dist(a.X, a.Z, b.X, b.Z)
	steps := int(d/1.8) + 1
	for i := 0; i <= steps; i++ {
		t := float64(i) / float64(steps)
		if !n.walkable(a.X+(b.X-a.X)*t, a.Z+(b.Z-a.Z)*t, 3.8) {
			return false
		}
	}
	return true
}
func (n *Nav) path(x, z, tx, tz float64) []Vec {
	a := Vec{x, z}
	b := Vec{clamp(tx, -orderLimit, orderLimit), clamp(tz, -orderLimit, orderLimit)}
	if n.line(a, b) {
		return []Vec{b}
	}
	start := n.nearest(x, z)
	end := n.nearest(b.X, b.Z)
	if start < 0 || end < 0 {
		return nil
	}
	var score [gridN * gridN]float64
	var previous [gridN * gridN]int
	var closed [gridN * gridN]bool
	for i := range score {
		score[i] = math.MaxFloat64
		previous[i] = -1
	}
	score[start] = 0
	open := []int{start}
	dest := gridPoint(end)
	for len(open) > 0 {
		bi := 0
		best := math.MaxFloat64
		for j, id := range open {
			p := gridPoint(id)
			v := score[id] + dist(p.X, p.Z, dest.X, dest.Z)
			if v < best {
				bi = j
				best = v
			}
		}
		id := open[bi]
		open = append(open[:bi], open[bi+1:]...)
		if closed[id] {
			continue
		}
		if id == end {
			break
		}
		closed[id] = true
		for dz := -1; dz <= 1; dz++ {
			for dx := -1; dx <= 1; dx++ {
				if dx == 0 && dz == 0 {
					continue
				}
				nx, nz := id%gridN+dx, id/gridN+dz
				if nx < 0 || nx >= gridN || nz < 0 || nz >= gridN {
					continue
				}
				next := nx + nz*gridN
				if n.blocked[next] || closed[next] {
					continue
				}
				if dx != 0 && dz != 0 && (n.blocked[id+dx] || n.blocked[id+dz*gridN]) {
					continue
				}
				v := score[id] + math.Hypot(float64(dx), float64(dz))*gridStep
				if v < score[next] {
					score[next] = v
					previous[next] = id
					open = append(open, next)
				}
			}
		}
	}
	if start != end && previous[end] < 0 {
		return nil
	}
	rev := []Vec{gridPoint(end)}
	for id := end; id != start; {
		id = previous[id]
		if id < 0 {
			return nil
		}
		rev = append(rev, gridPoint(id))
	}
	path := make([]Vec, 0, len(rev))
	for i := len(rev) - 2; i >= 0; i-- {
		path = append(path, rev[i])
	}
	if len(path) == 0 {
		path = append(path, gridPoint(end))
	}
	if n.line(path[len(path)-1], b) {
		path = append(path, b)
	}
	// String-pull the grid path without crossing obstacles.
	result := []Vec{}
	cur := a
	for i := 0; i < len(path); {
		j := i
		for j+1 < len(path) && n.line(cur, path[j+1]) {
			j++
		}
		result = append(result, path[j])
		cur = path[j]
		i = j + 1
	}
	return result
}
