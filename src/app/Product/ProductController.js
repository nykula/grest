const { Product } = require("../../domain/Product/Product");
const { Context } = require("../Context/Context");
const { Db } = require("../Db/Db");

class ProductController extends Context {
  constructor(/** @type {{ db: Db }} */ props) {
    super();

    /** @type {Product[]} */
    this.body = [new Product()];

    this.repo = props.db.repo(Product);
  }

  async delete() {
    if (!/^(name|price)=eq\.[a-z0-9-]+$/.test(this.query)) {
      throw new Error("403 Forbidden Delete Not By Name Or Price");
    }

    await this.repo.delete().parse(this.query);
  }

  async get() {
    this.body = await this.repo.get().parse(this.query);
  }

  async patch() {
    await this.repo.patch(this.body[0]).parse(this.query);
  }

  async post() {
    await this.repo.post(this.body);
  }
}

ProductController.watch = [Product];

exports.ProductController = ProductController;
