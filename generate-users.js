const bcrypt = require("bcrypt");

(async () => {
  const password = "123456"; 

  const hash = await bcrypt.hash(password, 10);

  console.log("Use this hash for all users:\n");
  console.log(hash);
})();