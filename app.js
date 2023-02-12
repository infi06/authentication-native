const { open } = require("sqlite");
const path = require("path");
const express = require("express");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB error:${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const logger = (request, response, next) => {
  console.log(request.query);
  next();
};

const authenticationToken = (request, response, next) => {
  console.log("Authentication Token");
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "ak2284ns8Di32", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//register
app.post("/register", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, password) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}'
          
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;

    response.status(200);
    response.send("User created successfully");
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "ak2284ns8Di32");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//get state API
app.get("/states/", logger, authenticationToken, async (request, response) => {
  const getStateQuery = `
    SELECT *
    FROM state
    ORDER BY state_id`;
  const stateList = await db.all(getStateQuery);
  response.send(
    stateList.map((eachState) => ({
      stateId: eachState.state_id,
      stateName: eachState.state_name,
      population: eachState.population,
    }))
  );
});

// get specific

app.get(
  "/states/:stateId/",
  logger,
  authenticationToken,
  async (request, response) => {
    console.log("Get specific state API");
    const { stateId, stateName, population } = request.params;
    const getStateValueQuery = `
    SELECT *
    FROM 
    state
    WHERE state_id=${stateId};`;
    const stateDetail = await db.get(getStateValueQuery);
    response.send({
      stateId: stateDetail.state_id,
      stateName: stateDetail.state_name,
      population: stateDetail.population,
    });
  }
);

// post district
app.post(
  "/districts/",
  logger,
  authenticationToken,
  async (request, response) => {
    console.log("Get specific district API");
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const addDistrictQuery = `INSERT INTO 
     district(district_name, state_id, cases, cured, active, deaths)
  VALUES (
      '${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths}
    );`;
    const dbResponse = await db.run(addDistrictQuery);
    console.log(dbResponse);
    response.send("District Successfully Added");
  }
);

//get specific district

app.get(
  "/districts/:districtId/",
  logger,
  authenticationToken,
  async (request, response) => {
    console.log("Get district API");
    const { districtId } = request.params;
    const getDistrictValueQuery = `
    SELECT *
    FROM 
    district
    WHERE district_id=${districtId};`;
    const districtDetail = await db.get(getDistrictValueQuery);
    response.send({
      districtId: districtDetail.district_id,
      districtName: districtDetail.district_name,
      stateId: districtDetail.state_id,
      cases: districtDetail.cases,
      cured: districtDetail.cured,
      active: districtDetail.active,
      deaths: districtDetail.deaths,
    });
  }
);

//get delete

app.delete(
  "/districts/:districtId/",
  logger,
  authenticationToken,
  async (request, response) => {
    console.log("delete district API");
    const { districtId } = request.params;

    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE 
      district_id = ${districtId};`;
    const districtDEl = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//update player API

app.put(
  "/districts/:districtId/",
  logger,
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtLatest = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtLatest;
    const updateDistrictQuery = `
    UPDATE district
    SET 
     district_name='${districtName}',
     state_id=${stateId},
     cases=${cases},
     cured=${cured},
     active=${active},
     deaths=${deaths}
     
    WHERE 
      district_id = ${districtId};`;
    const districtInform = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// state sum

app.get(
  "/states/:stateId/stats/",
  logger,
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT 
     SUM(cases),
     SUM(cured),
     SUM(active),
     SUM(deaths)
    FROM 
     district
    WHERE state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    console.log(stats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
