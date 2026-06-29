const dealerRepository = require("../repositories/dealerRepository");

async function getDealers(req, res) {
  try {
    const dealers = await dealerRepository.getDealers();
    res.json(dealers);
  } catch (err) {
    console.error("Get dealers failed:", err);

    res.status(500).json({
      message: "Failed to get dealers",
    });
  }
}

async function getDealerById(req, res) {
  try {
    const { id } = req.params;

    const dealer = await dealerRepository.getDealerById(id);

    if (!dealer) {
      return res.status(404).json({
        message: "Dealer not found",
      });
    }

    res.json(dealer);
  } catch (err) {
    console.error("Get dealer by id failed:", err);

    res.status(500).json({
      message: "Failed to get dealer",
    });
  }
}

async function getDealerDashboard(req, res) {
  try {
    const { id } = req.params;

    const dashboard = await dealerRepository.getDealerDashboard(id);

    if (!dashboard.summary) {
      return res.status(404).json({
        message: "Dealer not found",
      });
    }

    res.json(dashboard);
  } catch (err) {
    console.error("Get dealer dashboard failed:", err);

    res.status(500).json({
      message: "Failed to get dealer dashboard",
    });
  }
}

module.exports = {
  getDealers,
  getDealerById,
  getDealerDashboard,
};