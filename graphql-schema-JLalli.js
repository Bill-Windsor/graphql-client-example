import {promisify} from 'bluebird';
import stations from '../../data/stations.json';
import depots from '../../data/depots.json';
import offices from '../../data/offices.json';

import {getAuditsForLocation} from '../../data/queries/locationQueries.js';
import {all as getAllAudits} from '../../data/queries/simpleQueries.js';

import {
	GraphQLObjectType,
	GraphQLList,
	GraphQLSchema,
	GraphQLInt,
	GraphQLFloat,
	GraphQLBoolean,
	GraphQLString
} from 'graphql';

const getLocationAudits = promisify(getAuditsForLocation);
const getAudits = promisify(getAllAudits);

const AuditAnswer = new GraphQLObjectType({
	name: 'AuditAnswer',
	fields: () => ({
		value: {type: GraphQLString},
		selected: {type: GraphQLBoolean},
		photos: {type: new GraphQLList(GraphQLString)},
		comment: {type: GraphQLString},
		iconName: {type: GraphQLString}
	})
});

const AuditSubSection = new GraphQLObjectType({
	name: 'AuditSubSection',
	fields: () => ({
		title: {type: GraphQLString},
		comment: {type: GraphQLString},
		questions: {type: new GraphQLList(AuditAnswer)},
		score: {
			type: GraphQLInt,
			description: 'The overall score for this sub-section'
		}
	})
});

const AuditPlatform = new GraphQLObjectType({
	name: 'AuditPlatform',
	fields: () => ({
		platform: {
			type: GraphQLString,
			description: 'The platform number'
		},
		score: {
			type: GraphQLInt,
			description: 'The overall score for this platform'
		},
		subSections: {type: new GraphQLList(AuditSubSection)}
	})
});

const AuditSection = new GraphQLObjectType({
	name: 'AuditSubSection',
	fields: () => ({
		title: {
			type: GraphQLString,
			description: 'The title of the Audit Section'
		},
		comment: {type: GraphQLString},
		platforms: {
			type: new GraphQLList(AuditPlatform),
			description: 'The station platform sub-sections grouped by platform'
		},
		subSections: {
			type: new GraphQLList(AuditSubSection),
			description: 'The audit sub-sections'
		},
		score: {
			type: GraphQLInt,
			resolve: ({subSections, platforms}) => {
				let TotalScore = 0;

				const sumQuestionScores = subSection => {
					subSection.score = subSection.questions
						.map(q => (!q.iconName && q.selected) ? 1 : 0)
						.reduce((a,b) => a + b);

					return subSection.score;
				};

				if (subSections.length) {
					const subSectionScore = subSections 
						.map(sumQuestionScores)
						.reduce((a,b) => a + b);

					console.log('sub-section', subSectionScore);
					totalScore += subSectionScore;
				}

				if (platforms.length) {
					const platformScore = platforms 
						.map(p => {
							p.score = p.subSections 
								.map(sumQuestionScores)
								.reduce((a, b) => a + b);

							return p.score;
						})
						.reduce((a, b) => a + b);

						console.log('platform', platformScore);
						totalScore += platformScore;
					}

					console.log('total', totalScore);
					return totalScore;
			}
		}
	})
});

const Audit = new GraphQLObjectType({
	name: 'Audit',
	fields: () => ({
		id: {type: GraphQLString},
		startTime: {type: GraphQLString},
		completeTime: {type: GraphQLString},
		username: {type: GraphQLString},
		sections: {type: new GraphQLList(AuditSection)}
	})
});

const TrainAudit = new GraphQLObjectType({
	name: 'TrainAudit',
	fields: () => ({
		id: {type: GraphQLString},
		startTime: {type: GraphQLString},
		completeTime: {type: GraphQLString},
		username: {type: GraphQLString},
		departureStation: {type: GraphQLString},
		departureTime: {type: GraphQLString},
		arrivalStation: {type: GraphQLString},
		arrivalTime: {type: GraphQLString},
		sections: {type: new GraphQLList(AuditSection)}
	})
});

const Train = new GraphQLObjectType({
	name: 'Train',
	description: 'A choo-choo train',
	fields: () => ({
		audits: {
			type: new GraphQLList(TrainAudit),
			description: 'All audits for trains'
		}
	})
});

const Station = new GraphQLObjectType({
	name: 'Station',
	description: 'A train station',
	fields: () => ({
		name: {type: GraphQLString},
		latitude: {type: GraphQLFloat},
		longitude: {type: GraphQLFloat},
		platforms: {
			type: new GraphQLList(GraphQLString),
			description: 'List of platform numbers',
			resolve: (parent) => {
				return parent.platforms 
					.map(p => {
						return p.match(/[0-9]+[a-z]?/)[0];
					})
					.sort();
			}
		},
		lastAuditDate: {
			type: GraphQLString,
			description: 'The date this station was last audited',
			resolve: (parent, {}, {rootValue: { station } }) => {
				return getLocationAudits(station, parent.name).then(audits => {
					const latest = audits.shift();
					return latest ? latest.completeTime : '--';
				});
			}
		},
		audits: {
			type: new GraphQLList(Audit),
			description: 'All audits for this station',
			resolve: (parent, {}, {rootValue: { station } }) => {
				return getLocationAudits(station, parent.name).then(audits => audits);
			}
		}
	})
});

const Depot = new GraphQLObjectType({
	name: 'Depot',
	description: 'A train depot',
	fields: () => ({
		name: {type: GraphQLString},
		lastAuditDate: {
			type: GraphQLString,
			description: 'The date this depot was last audited',
			resolve: (parent, {}, {rootValue: { depot } }) => {
				return getLocationAudits(depot, parent.name).then(audits => {
					const latest = audits.shift();
					return latest ? latest.completeTime : '--';
				});
			}
		},
		audits: {
			type: new GraphQLList(Audit),
			description: 'All audits for this depot',
			resolve: (parent, {}, {rootValue: { depot } }) => {
				return getLocationAudits(depot, parent.name).then(audits => audits);
			}
		}
	})
});

const Office = new GraphQLObjectType({
	name: 'Office',
	description: 'An office',
	fields: () => ({
		name: {type: GraphQLString},
		lastAuditDate: {
			type: GraphQLString,
			description: 'The date this office was last audited',
			resolve: (parent, {}, {rootValue: { office } }) => {
				return getLocationAudits(office, parent.name).then(audits => {
					const latest = audits.shift();
					return latest ? latest.completeTime : '--';	
				});
			}
		},
		audits: {
			type: new GraphQLList(Audit),
			description: 'All audits for this office',
			resolve: (parent, {}, {rootValue: { office } }) => {
				return getLocationAudits(office, parent.name).then(audits => audits);
			}
		}
	})
});

const Query = new GraphQLObjectType({
	name: 'Query',
	description: 'Main audits query',
	fields: () => ({
		stations: {
			type: new GraphQLList(Station),
			description: 'List of train stations',
			args: {
				name: {
					description: 'The name of the train station',
					type: GraphQLString
				}
			},
			resolve: (parent, {name}) => {
				return stations
				.stations
				.filter(stn => (name ? name === stn.name : true));
			}
		},
		trains: {
			type: Train,
			description: 'Trains and their audits',
			args: {
				from: {
					description: 'The station the train departed from',
					type: GraphQLString
				},
				to: {
					description: 'The station the train arrived at',
					type: GraphQLString
				}
			},
			resolve: (parent, {from, to}, { rootValue: { train } }) => {

				const departureStation = (audit) => {
					return from ? audit.departureStation === from : true;
				};

				const arrivalStation = (audit) => {
					return to ? audit.arrivalStation === to : true;
				};

				return getAudits(train).then(audits => {
					return {
						audits: audits.filter(audit => departureStation(audit) && arrivalStation(audit))
					};
				});
			}
		},
		depots: {
			type: new GraphQLList(Depot),
			description: 'List of train depots',
			args: {
				name: {
					description: 'The name of the depot',
					type: GraphQLString
				}
			},
			resolve: (parent, {name}) => {
				if (parent === 'sqms') return [];

				return depots
				.depots
				.filter(d => (name ? name === d : true));
			}
		},
		offices: {
			type: new GraphQLList(Office),
			description: 'List of offices',
			args: {
				name: {
					description: 'The name of the office',
					type: GraphQLString
				}
			},
			resolve: (parent, {name}) => {
				if (parent === 'sqms') return [];
				return offices
				.offices
				.filter(o => (name ? name === o : true));
			}
		}
	})
});

const Schema = new GraphQLSchema({query: Query});
export default Schema;
