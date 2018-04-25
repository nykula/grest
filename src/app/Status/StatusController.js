const GLib = imports.gi.GLib;
const { Status } = require("../../domain/Status/Status");
const { Context } = require("../Context/Context");

class StatusController extends Context {
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

    print(JSON.stringify(body));

    return body.length;
  }
}

exports.StatusController = StatusController;
