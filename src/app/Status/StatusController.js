const GLib = imports.gi.GLib;
const { Status } = require("../../domain/Status/Status");
const { Context } = require("../Context/Context");

class StatusController extends Context {
  constructor() {
    super();

    /** @type {Status[]} */
    this.body = [new Status()];
  }

  async get() {
    const status = new Status();

    const pagination = "state=opened&per_page=100";

    [
      status.crashers,
      status.bugs,
      status.newcomers,
      status.issues,
      status.mrs
    ] = await Promise.all([
      this.count(`/issues?${pagination}&labels=1.+Crash`),
      this.count(`/issues?${pagination}&labels=1.+Bug`),
      this.count(`/issues?${pagination}&labels=4.+Newcomers`),
      this.count(`/issues?${pagination}`),
      this.count(`/merge_requests?${pagination}`)
    ]);

    this.body = [status];
  }

  async post() {
    const statuses = this.body;

    for (const status of statuses) {
      status.mrs = Math.floor(Math.random() * 10000);
    }

    this.body = statuses;
  }

  /**
   * @private
   * @param {string} path
   */
  async count(path) {
    const base = "https://gitlab.gnome.org/api/v4/projects/GNOME%2Fgjs";

    const { body } = await Context.fetch(`${base}${path}`, {
      headers: {
        "Private-Token": GLib.getenv("GITLAB_TOKEN")
      }
    });

    return body.length;
  }
}

exports.StatusController = StatusController;
