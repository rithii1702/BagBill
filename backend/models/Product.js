import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    bagType: {
      type: String,
      required: true,
      enum: ['Gunny Bag', 'Jute Bag', 'PP Bag', 'Plastic Bag', 'HDPE Bag', 'Custom Bag'],
      default: 'Gunny Bag',
    },
    category: {
      type: String,
      default: 'Standard',
      trim: true,
    },
    defaultPrice: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    rate: {
      type: Number,
      min: [0, 'Rate cannot be negative'],
      default: 0,
    },
    hsnCode: {
      type: String,
      default: '630510',
      trim: true,
    },
    hsnSac: {
      type: String,
      default: '630510',
      trim: true,
    },
    gstRate: {
      type: Number,
      default: 5,
      min: [0, 'GST rate cannot be negative'],
    },
    unit: {
      type: String,
      default: 'Bag',
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

productSchema.pre('save', function (next) {
  if (this.defaultPrice !== undefined && (!this.rate || this.rate === 0)) {
    this.rate = this.defaultPrice;
  }
  if (this.rate !== undefined && (!this.defaultPrice || this.defaultPrice === 0)) {
    this.defaultPrice = this.rate;
  }
  if (this.hsnCode && !this.hsnSac) {
    this.hsnSac = this.hsnCode;
  }
  if (this.hsnSac && !this.hsnCode) {
    this.hsnCode = this.hsnSac;
  }
  next();
});

productSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model('Product', productSchema);
export default Product;
