#!/usr/bin/env cgjs

const GLib = imports.gi.GLib;
const { App } = require("../src/app/App");

const port = Number(GLib.getenv("PORT"));
print(`Listening on ${port}`);
App.listen_all(port, 0);

App.run();