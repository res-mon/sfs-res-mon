package backend

import (
	"io/fs"
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

func Main(isGoRun bool, dist fs.FS) {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		// enable auto creation of migration files when making collection changes in the Dashboard
		// (the isGoRun check is to enable it only during development)
		Automigrate: isGoRun,

		Dir: "pb_data/../src/backend/migrations",
	})

	var fsList FSList
	if app.IsDev() {
		fsList = append(fsList, os.DirFS("dist"), os.DirFS("pb_public"), dist)
	} else {
		fsList = append(fsList, dist, os.DirFS("pb_public"))
	}

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/{path...}", apis.Static(fsList, true))

		return se.Next()
	})

	RegisterAPI(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

type FSList []fs.FS

func (f FSList) Open(name string) (fs.File, error) {
	for _, fs := range f {
		file, err := fs.Open(name)
		if err == nil {
			return file, nil
		}
	}
	return nil, os.ErrNotExist
}
