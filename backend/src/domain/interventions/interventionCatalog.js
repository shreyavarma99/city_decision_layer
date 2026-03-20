export const interventionCatalog = [
  {
    id: 'bike-lane',
    label: 'Bike lane',
    description:
      'Repurpose curb or travel space to create a protected or painted bicycle facility along a corridor.',
    geometryType: 'line',
    placement: {
      allowedRoadClasses: ['street', 'street_limited', 'tertiary', 'secondary', 'primary'],
      emptyLabel: 'Drop the bike lane on a road.',
      blockedLabel: 'Bike lanes are limited to eligible surface streets in this prototype.',
    },
    styling: {
      color: '#22c55e',
      previewColor: '#38bdf8',
    },
    analysisHints: [
      'corridor_safety',
      'network_connectivity',
      'vehicle_capacity_tradeoff',
      'transit_interaction',
    ],
  },
  {
    id: 'crosswalk',
    label: 'Crosswalk',
    description:
      'Add a formal pedestrian crossing treatment at a local street location to improve crossing safety.',
    geometryType: 'line',
    placement: {
      allowedRoadClasses: ['street', 'street_limited', 'tertiary'],
      emptyLabel: 'Drop the crosswalk on a local street.',
      blockedLabel:
        'Crosswalks can only be placed on local roads, not highways or major arterials.',
    },
    styling: {
      color: '#f8fafc',
      previewColor: '#38bdf8',
    },
    analysisHints: [
      'pedestrian_safety',
      'crossing_demand',
      'signal_warrant_screening',
      'accessibility',
    ],
  },
]
