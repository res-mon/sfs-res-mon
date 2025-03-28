package main

import (
	"embed"
	"io/fs"
	"log"
	"os"
	"strings"

	"github.com/yerTools/simple-frontend-stack/src/backend"

	_ "github.com/yerTools/simple-frontend-stack/src/backend/migrations" // Import migrations for side effects
)

//go:embed dist
var dist embed.FS

func main() {
	dist, err := fs.Sub(dist, "dist")
	if err != nil {
		log.Panicf("failed to create sub fs: %v", err)
	}

	// loosely check if it was executed using "go run"
	isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())

	backend.Main(isGoRun, dist)
}
