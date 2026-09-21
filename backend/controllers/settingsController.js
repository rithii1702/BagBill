import Settings from '../models/Settings.js';

// @desc    Get current business & application settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update business & application settings
// @route   PUT /api/settings
// @access  Public
export const updateSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      // Assign root properties from flat frontend payload
      Object.keys(req.body).forEach(key => {
        if (key !== '_id' && key !== 'id' && key !== '__v') {
          settings[key] = req.body[key];
        }
      });

      // Also support nested updates if passed
      if (req.body.businessProfile && typeof req.body.businessProfile === 'object') {
        settings.businessProfile = { ...settings.businessProfile, ...req.body.businessProfile };
      }
      if (req.body.invoiceSettings && typeof req.body.invoiceSettings === 'object') {
        settings.invoiceSettings = { ...settings.invoiceSettings, ...req.body.invoiceSettings };
      }
      if (req.body.bankDetails && typeof req.body.bankDetails === 'object') {
        settings.bankDetails = { ...settings.bankDetails, ...req.body.bankDetails };
      }
      if (req.body.taxSettings && typeof req.body.taxSettings === 'object') {
        settings.taxSettings = { ...settings.taxSettings, ...req.body.taxSettings };
      }
    }

    const updatedSettings = await settings.save();
    res.json({
      success: true,
      data: updatedSettings,
    });
  } catch (error) {
    next(error);
  }
};
