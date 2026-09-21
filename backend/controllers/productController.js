import Product from '../models/Product.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const { includeArchived, search, bagType } = req.query;
    const filter = {};

    if (includeArchived !== 'true') {
      filter.isArchived = { $ne: true };
    }

    if (bagType) {
      filter.bagType = bagType;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { hsnCode: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(filter).sort({ name: 1 });
    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error(`Product not found with id ${req.params.id}`);
    }
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Public
export const createProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.stock !== undefined && data.stock !== null && data.stock !== '') {
      const stockNum = Number(data.stock);
      if (isNaN(stockNum) || stockNum < 0) {
        res.status(400);
        throw new Error('Stock must be a valid non-negative number');
      }
      data.stock = stockNum;
    }
    const product = await Product.create(data);
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Public
export const updateProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.stock !== undefined && data.stock !== null && data.stock !== '') {
      const stockNum = Number(data.stock);
      if (isNaN(stockNum) || stockNum < 0) {
        res.status(400);
        throw new Error('Stock must be a valid non-negative number');
      }
      data.stock = stockNum;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404);
      throw new Error(`Product not found with id ${req.params.id}`);
    }
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive or Delete product
// @route   DELETE /api/products/:id
// @access  Public
export const deleteProduct = async (req, res, next) => {
  try {
    const { permanent } = req.query;
    if (permanent === 'true') {
      const product = await Product.findByIdAndDelete(req.params.id);
      if (!product) {
        res.status(404);
        throw new Error(`Product not found with id ${req.params.id}`);
      }
      return res.json({
        success: true,
        message: 'Product permanently deleted',
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isArchived: true },
      { new: true }
    );
    if (!product) {
      res.status(404);
      throw new Error(`Product not found with id ${req.params.id}`);
    }
    res.json({
      success: true,
      message: 'Product archived successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};
