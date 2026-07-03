const dealerRepo = require("../repositories/dealerRepository");

async function getDealers(req, res) {
  try {
    const data = await dealerRepo.getDealers();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to load dealers",
    });
  }
}

async function createDealer(req, res) {
  try {
    const data = await dealerRepo.createDealer(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to create dealer",
    });
  }
}

async function updateDealer(req, res) {
  try {
    const data = await dealerRepo.updateDealer(req.params.id, req.body);

    if (!data) {
      return res.status(404).json({
        error: "Dealer not found",
      });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to update dealer",
    });
  }
}

async function updateDealerStatus(req, res) {
  try {
    const data = await dealerRepo.updateDealerStatus(
      req.params.id,
      Boolean(req.body.portal_enabled)
    );

    if (!data) {
      return res.status(404).json({
        error: "Dealer not found",
      });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to update dealer status",
    });
  }
}

async function resetDealerPassword(req, res) {
  try {
    if (!req.body.password) {
      return res.status(400).json({
        error: "Password is required",
      });
    }

    const data = await dealerRepo.resetDealerPassword(
      req.params.id,
      req.body.password
    );

    if (!data) {
      return res.status(404).json({
        error: "Dealer user not found",
      });
    }

    res.json({
      success: true,
      dealer_id: data.dealer_id,
      email: data.email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to reset dealer password",
    });
  }
}

module.exports = {
  getDealers,
  createDealer,
  updateDealer,
  updateDealerStatus,
  resetDealerPassword,
};