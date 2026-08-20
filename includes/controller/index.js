const { graphQlQueryToJson } = require("graphql-query-to-json");
const ora = require("ora");
const { log, getText } = global.utils;
const { config } = global.GoatBot;
const databaseType = config.database.type;

// with add null if not found data
function fakeGraphql(query, data, obj = {}) {
	if (typeof query != "string" && typeof query != "object")
		throw new Error(`The "query" argument must be of type string or object, got ${typeof query}`);
	if (query == "{}" || !data)
		return data;
	if (typeof query == "string")
		query = graphQlQueryToJson(query).query;
	const keys = query ? Object.keys(query) : [];
	for (const key of keys) {
		if (typeof query[key] === 'object') {
			if (!Array.isArray(data[key]))
				obj[key] = data.hasOwnProperty(key) ? fakeGraphql(query[key], data[key] || {}, obj[key]) : null;
			else
				obj[key] = data.hasOwnProperty(key) ? data[key].map(item => fakeGraphql(query[key], item, {})) : null;
		}
		else
			obj[key] = data.hasOwnProperty(key) ? data[key] : null;
	}
	return obj;
}

module.exports = async function (api) {
	console.log(`[DATABASE] Initializing with type: ${databaseType}`);
	
	var threadModel, userModel, dashBoardModel, globalModel, sequelize = null;
	
	switch (databaseType) {
		case "mongodb": {
			const spin = ora({
				text: getText('indexController', 'connectingMongoDB'),
				spinner: {
					interval: 80,
					frames: [
						'⠋', '⠙', '⠹',
						'⠸', '⠼', '⠴',
						'⠦', '⠧', '⠇',
						'⠏'
					]
				}
			});
			const defaultClearLine = process.stderr.clearLine;
			process.stderr.clearLine = function () { };
			spin.start();
			try {
				var { threadModel, userModel, dashBoardModel, globalModel } = await require("../connectDB/connectMongoDB.js")(config.database.uriMongodb);
				spin.stop();
				process.stderr.clearLine = defaultClearLine;
				log.info("MONGODB", getText("indexController", "connectMongoDBSuccess"));
				console.log(`[DATABASE] MongoDB models loaded: userModel=${!!userModel}, threadModel=${!!threadModel}`);
			}
			catch (err) {
				spin.stop();
				process.stderr.clearLine = defaultClearLine;
				log.err("MONGODB", getText("indexController", "connectMongoDBError"), err);
				process.exit();
			}
			break;
		}
		case "sqlite": {
			const spin = ora({
				text: getText('indexController', 'connectingMySQL'),
				spinner: {
					interval: 80,
					frames: [
						'⠋', '⠙', '⠹',
						'⠸', '⠼', '⠴',
						'⠦', '⠧', '⠇',
						'⠏'
					]
				}
			});
			const defaultClearLine = process.stderr.clearLine;
			process.stderr.clearLine = function () { };
			spin.start();
			try {
				var { threadModel, userModel, dashBoardModel, globalModel, sequelize } = await require("../connectDB/connectSqlite.js")();
				process.stderr.clearLine = defaultClearLine;
				spin.stop();
				log.info("SQLITE", getText("indexController", "connectMySQLSuccess"));
				console.log(`[DATABASE] SQLite models loaded: userModel=${!!userModel}, threadModel=${!!threadModel}`);
			}
			catch (err) {
				process.stderr.clearLine = defaultClearLine;
				spin.stop();
				log.err("SQLITE", getText("indexController", "connectMySQLError"), err);
				process.exit();
			}
			break;
		}
		default:
			log.err("DATABASE", `Unknown database type: ${databaseType}`);
			process.exit();
			break;
	}

	// FIX: Check if usersData.js is properly structured
	let usersData;
	console.log(`[DATABASE] Loading usersData module...`);
	try {
		const usersDataModule = require("./usersData.js");
		console.log(`[DATABASE] usersData module type: ${typeof usersDataModule}`);
		
		if (typeof usersDataModule === 'function') {
			console.log(`[DATABASE] Initializing usersData with databaseType: ${databaseType}`);
			usersData = await usersDataModule(databaseType, userModel, api, fakeGraphql);
			console.log(`[DATABASE] usersData loaded successfully, methods: ${Object.keys(usersData).join(', ')}`);
		} else {
			// If it's not a function, create emergency usersData
			log.warn("DATABASE", "usersData.js is not a function, creating emergency usersData");
			console.log(`[DATABASE] Creating emergency usersData`);
			usersData = createEmergencyUsersData(api);
		}
	} catch (error) {
		log.error("DATABASE", "Failed to load usersData:", error);
		console.error(`[DATABASE] Error loading usersData:`, error);
		usersData = createEmergencyUsersData(api);
	}

	// FIX: Load other data modules with error handling
	let threadsData, dashBoardData, globalData;
	
	console.log(`[DATABASE] Loading threadsData...`);
	try {
		const threadsDataModule = require("./threadsData.js");
		threadsData = typeof threadsDataModule === 'function' 
			? await threadsDataModule(databaseType, threadModel, api, fakeGraphql)
			: createEmergencyThreadsData(api);
		console.log(`[DATABASE] threadsData loaded: ${!!threadsData}`);
	} catch (error) {
		log.error("DATABASE", "Failed to load threadsData:", error);
		console.error(`[DATABASE] Error loading threadsData:`, error);
		threadsData = createEmergencyThreadsData(api);
	}
	
	console.log(`[DATABASE] Loading dashBoardData...`);
	try {
		const dashBoardDataModule = require("./dashBoardData.js");
		dashBoardData = typeof dashBoardDataModule === 'function'
			? await dashBoardDataModule(databaseType, dashBoardModel, fakeGraphql)
			: createEmergencyDashBoardData();
		console.log(`[DATABASE] dashBoardData loaded: ${!!dashBoardData}`);
	} catch (error) {
		log.error("DATABASE", "Failed to load dashBoardData:", error);
		console.error(`[DATABASE] Error loading dashBoardData:`, error);
		dashBoardData = createEmergencyDashBoardData();
	}
	
	console.log(`[DATABASE] Loading globalData...`);
	try {
		const globalDataModule = require("./globalData.js");
		globalData = typeof globalDataModule === 'function'
			? await globalDataModule(databaseType, globalModel, fakeGraphql)
			: createEmergencyGlobalData();
		console.log(`[DATABASE] globalData loaded: ${!!globalData}`);
	} catch (error) {
		log.error("DATABASE", "Failed to load globalData:", error);
		console.error(`[DATABASE] Error loading globalData:`, error);
		globalData = createEmergencyGlobalData();
	}

	// CRITICAL FIX: Ensure usersData.getName exists and works
	if (usersData) {
		console.log(`[DATABASE] Checking usersData.getName method...`);
		if (!usersData.getName || typeof usersData.getName !== 'function') {
			log.warn("DATABASE", "usersData.getName method missing, adding emergency method");
			console.log(`[DATABASE] Adding emergency getName method`);
			
			usersData.getName = async (userID) => {
				console.log(`[EMERGENCY getName] Called for userID: ${userID}`);
				try {
					// First try to get from database model
					if (userModel && typeof userModel.findOne === 'function') {
						try {
							const user = await userModel.findOne({
								where: { userID: userID.toString() }
							});
							if (user && user.name) {
								console.log(`[EMERGENCY getName] Found in DB: ${user.name}`);
								return user.name;
							}
						} catch (dbError) {
							console.log(`[EMERGENCY getName] DB query failed: ${dbError.message}`);
						}
					}
					
					// Then try API
					if (api && typeof api.getUserInfo === 'function') {
						try {
							const userInfo = await api.getUserInfo(userID);
							const name = userInfo[userID]?.name;
							if (name) {
								console.log(`[EMERGENCY getName] Found via API: ${name}`);
								return name;
							}
						} catch (apiError) {
							console.log(`[EMERGENCY getName] API failed: ${apiError.message}`);
						}
					}
					
					// Final fallback
					console.log(`[EMERGENCY getName] Using fallback for ${userID}`);
					return `User_${userID}`;
				} catch (error) {
					console.error(`[EMERGENCY getName] Error:`, error);
					return `User_${userID}`;
				}
			};
		} else {
			console.log(`[DATABASE] usersData.getName method exists`);
			
			// Wrap the existing getName method for better error handling
			const originalGetName = usersData.getName;
			usersData.getName = async function(userID) {
				try {
					console.log(`[usersData.getName] Calling for ${userID}`);
					const result = await originalGetName.call(this, userID);
					console.log(`[usersData.getName] Result for ${userID}: ${result}`);
					return result;
				} catch (error) {
					console.error(`[usersData.getName] Error for ${userID}:`, error);
					// Fallback
					try {
						if (api && typeof api.getUserInfo === 'function') {
							const userInfo = await api.getUserInfo(userID);
							return userInfo[userID]?.name || `User_${userID}`;
						}
					} catch (apiError) {
						console.error(`[usersData.getName] API fallback failed:`, apiError);
					}
					return `User_${userID}`;
				}
			};
		}
		
		// Add other essential methods if missing
		const essentialMethods = ['get', 'set', 'getAll', 'create'];
		for (const method of essentialMethods) {
			if (!usersData[method] || typeof usersData[method] !== 'function') {
				console.warn(`[DATABASE] usersData.${method} method missing, adding dummy`);
				usersData[method] = async function(...args) {
					console.warn(`[DUMMY usersData.${method}] Called with args:`, args);
					return null;
				};
			}
		}
	} else {
		console.error(`[DATABASE] CRITICAL: usersData is null or undefined!`);
		usersData = createEmergencyUsersData(api);
	}

	// Load initial data into global.db
	console.log(`[DATABASE] Setting up global.db...`);
	global.db = {
		...global.db,
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		threadsData,
		usersData, // Make sure this is included
		dashBoardData,
		globalData,
		sequelize
	};

	console.log(`[DATABASE] Controller initialization complete`);
	console.log(`[DATABASE] usersData ready: ${!!usersData}, has getName: ${!!usersData.getName}`);
	console.log(`[DATABASE] userModel: ${!!userModel}, threadModel: ${!!threadModel}`);

	return {
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		threadsData,
		usersData, // Must return this
		dashBoardData,
		globalData,
		sequelize,
		databaseType
	};
};

// Emergency data functions
function createEmergencyUsersData(api) {
	console.log(`[DATABASE] Creating emergency usersData`);
	
	return {
		getAll: async () => {
			console.log("EMERGENCY: getAll called");
			return [];
		},
		getName: async (userID) => {
			console.log(`EMERGENCY getName: Called for ${userID}`);
			try {
				if (api && typeof api.getUserInfo === 'function') {
					const userInfo = await api.getUserInfo(userID);
					const name = userInfo[userID]?.name;
					if (name) {
						console.log(`EMERGENCY getName: Found via API: ${name}`);
						return name;
					}
				}
				console.log(`EMERGENCY getName: Using fallback for ${userID}`);
				return `User_${userID}`;
			} catch (error) {
				console.error(`EMERGENCY getName: Error:`, error);
				return `User_${userID}`;
			}
		},
		get: async (userID) => {
			console.log(`EMERGENCY: get called for ${userID}`);
			return null;
		},
		set: async (userID, data = {}) => {
			console.log(`EMERGENCY: set called for ${userID}`, data);
			return { userID, name: data.name || 'Emergency User' };
		},
		update: async (userID, data) => {
			console.log(`EMERGENCY: update called for ${userID}`, data);
			return null;
		},
		delete: async (userID) => {
			console.log(`EMERGENCY: delete called for ${userID}`);
			return false;
		},
		count: async () => {
			console.log("EMERGENCY: count called");
			return 0;
		},
		find: async (where) => {
			console.log("EMERGENCY: find called", where);
			return [];
		},
		// Add more methods for compatibility
		getMoney: async () => 0,
		addMoney: async () => null,
		subtractMoney: async () => null,
		refreshInfo: async () => null,
		deleteKey: async () => null,
		remove: async () => true,
		existsSync: () => false
	};
}

function createEmergencyThreadsData(api) {
	console.log(`[DATABASE] Creating emergency threadsData`);
	
	return {
		getAll: async () => {
			console.log("EMERGENCY: threadsData.getAll called");
			return [];
		},
		getName: async (threadID) => {
			console.log(`EMERGENCY: threadsData.getName called for ${threadID}`);
			return `Thread_${threadID}`;
		},
		get: async (threadID) => {
			console.log(`EMERGENCY: threadsData.get called for ${threadID}`);
			return null;
		},
		create: async (threadID, data) => {
			console.log(`EMERGENCY: threadsData.create called for ${threadID}`, data);
			return { threadID, threadName: data?.threadName || 'Emergency Thread' };
		},
		set: async (threadID, data) => {
			console.log(`EMERGENCY: threadsData.set called for ${threadID}`, data);
			return null;
		},
		refreshInfo: async () => null
	};
}

function createEmergencyDashBoardData() {
	console.log(`[DATABASE] Creating emergency dashBoardData`);
	
	return {
		getAll: async () => {
			console.log("EMERGENCY: dashBoardData.getAll called");
			return [];
		},
		get: async () => {
			console.log("EMERGENCY: dashBoardData.get called");
			return null;
		},
		set: async () => {
			console.log("EMERGENCY: dashBoardData.set called");
			return null;
		}
	};
}

function createEmergencyGlobalData() {
	console.log(`[DATABASE] Creating emergency globalData`);
	
	return {
		getAll: async () => {
			console.log("EMERGENCY: globalData.getAll called");
			return [];
		},
		get: async () => {
			console.log("EMERGENCY: globalData.get called");
			return null;
		},
		set: async () => {
			console.log("EMERGENCY: globalData.set called");
			return null;
		}
	};
}
