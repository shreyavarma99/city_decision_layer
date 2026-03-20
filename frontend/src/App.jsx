import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { fetchInterventionCatalog } from './lib/interventionsApi'
import './App.css'

const DEFAULT_CENTER = [-97.7431, 30.2672]
const INTERVENTION_SOURCE_ID = 'planned-interventions'
const DROP_PREVIEW_SOURCE_ID = 'drop-preview'

function createFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    features,
  }
}

function getRoadClass(feature) {
  return (
    feature?.properties?.class ??
    feature?.properties?.road_class ??
    feature?.properties?.type ??
    ''
  )
}

function getPlacementRules(toolId, interventionCatalogById) {
  const intervention = interventionCatalogById.get(toolId)
  const placement = intervention?.placement ?? {}

  return {
    allowedClasses: new Set(placement.allowedRoadClasses ?? []),
    blockedLabel:
      placement.blockedLabel ?? 'This intervention cannot be placed on the selected road.',
    emptyLabel: placement.emptyLabel ?? 'Drop the intervention on a valid road.',
  }
}

function getRoadPlacementState(toolId, roadFeature, interventionCatalogById) {
  if (!toolId || !roadFeature) {
    return { isValid: false, roadClass: '', message: '' }
  }

  const rules = getPlacementRules(toolId, interventionCatalogById)
  const roadClass = getRoadClass(roadFeature)
  const isValid = rules.allowedClasses.has(roadClass)

  return {
    isValid,
    roadClass,
    message: isValid ? `Valid ${toolId.replace('-', ' ')} target.` : rules.blockedLabel,
  }
}

function getRoadLayerIds(map) {
  return map
    .getStyle()
    .layers.filter((layer) => {
      const sourceLayer = layer['source-layer'] ?? ''
      return layer.type === 'line' && /road|street|bridge|tunnel/i.test(`${layer.id} ${sourceLayer}`)
    })
    .map((layer) => layer.id)
}

function flattenLineCoordinates(geometry) {
  if (!geometry) {
    return []
  }

  if (geometry.type === 'LineString') {
    return [geometry.coordinates]
  }

  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates
  }

  return []
}

function projectPointToSegment(point, start, end) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const segmentLengthSquared = dx * dx + dy * dy

  if (segmentLengthSquared === 0) {
    return { point: start, t: 0, distanceSquared: Infinity }
  }

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / segmentLengthSquared),
  )

  const projectedPoint = [start[0] + dx * t, start[1] + dy * t]
  const distanceSquared =
    (point[0] - projectedPoint[0]) ** 2 + (point[1] - projectedPoint[1]) ** 2

  return { point: projectedPoint, t, distanceSquared }
}

function getNearestRoadPosition(point, geometry) {
  const lines = flattenLineCoordinates(geometry)
  let bestMatch = null

  for (const line of lines) {
    for (let index = 0; index < line.length - 1; index += 1) {
      const start = line[index]
      const end = line[index + 1]
      const projection = projectPointToSegment(point, start, end)

      if (!bestMatch || projection.distanceSquared < bestMatch.distanceSquared) {
        bestMatch = {
          ...projection,
          start,
          end,
        }
      }
    }
  }

  return bestMatch
}

function metersToDegreesLng(meters, latitude) {
  return meters / (111320 * Math.cos((latitude * Math.PI) / 180))
}

function metersToDegreesLat(meters) {
  return meters / 110540
}

function buildCrosswalkGeometry(anchorPoint, start, end) {
  const roadAngle = Math.atan2(end[1] - start[1], end[0] - start[0])
  const crosswalkAngle = roadAngle + Math.PI / 2
  const crosswalkHalfLengthMeters = 6
  const lngOffset = metersToDegreesLng(
    crosswalkHalfLengthMeters * Math.cos(crosswalkAngle),
    anchorPoint[1],
  )
  const latOffset = metersToDegreesLat(crosswalkHalfLengthMeters * Math.sin(crosswalkAngle))

  return {
    type: 'LineString',
    coordinates: [
      [anchorPoint[0] - lngOffset, anchorPoint[1] - latOffset],
      [anchorPoint[0] + lngOffset, anchorPoint[1] + latOffset],
    ],
  }
}

function createInterventionFeature(toolId, roadFeature, mapPoint, id) {
  if (toolId === 'bike-lane') {
    return {
      type: 'Feature',
      geometry: roadFeature.geometry,
      properties: {
        id,
        interventionType: toolId,
        label: 'Planned bike lane',
      },
    }
  }

  const nearestRoadPosition = getNearestRoadPosition(mapPoint, roadFeature.geometry)

  if (!nearestRoadPosition) {
    return null
  }

  return {
    type: 'Feature',
    geometry: buildCrosswalkGeometry(
      nearestRoadPosition.point,
      nearestRoadPosition.start,
      nearestRoadPosition.end,
    ),
    properties: {
      id,
      interventionType: toolId,
      label: 'Planned crosswalk',
    },
  }
}

function createPreviewFeature(roadFeature, toolId, isValid) {
  if (!roadFeature || !toolId) {
    return createFeatureCollection([])
  }

  return createFeatureCollection([
    {
      type: 'Feature',
      geometry: roadFeature.geometry,
      properties: {
        interventionType: toolId,
        isValid: isValid ? 'true' : 'false',
      },
    },
  ])
}

function App() {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const roadLayerIdsRef = useRef([])
  const [isMapReady, setIsMapReady] = useState(false)
  const [interventions, setInterventions] = useState([])
  const [statusMessage, setStatusMessage] = useState(
    'Drag a bike lane or crosswalk card onto a road to start planning.',
  )
  const [draggingToolId, setDraggingToolId] = useState(null)
  const [dropTargetState, setDropTargetState] = useState('idle')
  const [previewFeatureCollection, setPreviewFeatureCollection] = useState(
    createFeatureCollection([]),
  )
  const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  const [interventionCatalog, setInterventionCatalog] = useState([])
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [catalogError, setCatalogError] = useState('')
  const interventionCatalogById = useMemo(
    () => new Map(interventionCatalog.map((intervention) => [intervention.id, intervention])),
    [interventionCatalog],
  )
  const interventionSummary = useMemo(() => {
    const bikeLanes = interventions.filter(
      (feature) => feature.properties.interventionType === 'bike-lane',
    ).length
    const crosswalks = interventions.filter(
      (feature) => feature.properties.interventionType === 'crosswalk',
    ).length

    return { bikeLanes, crosswalks }
  }, [interventions])

  useEffect(() => {
    const abortController = new AbortController()

    async function loadInterventionCatalog() {
      try {
        setCatalogStatus('loading')
        setCatalogError('')
        const catalog = await fetchInterventionCatalog(abortController.signal)
        setInterventionCatalog(catalog)
        setCatalogStatus('ready')
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }

        setCatalogStatus('error')
        setCatalogError(
          'Could not load interventions from the backend. Start the backend to make the planner available.',
        )
      }
    }

    loadInterventionCatalog()

    return () => {
      abortController.abort()
    }
  }, [])

  useEffect(() => {
    if (!accessToken || !mapContainerRef.current || mapRef.current) {
      return undefined
    }

    mapboxgl.accessToken = accessToken

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: DEFAULT_CENTER,
      zoom: 13,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      roadLayerIdsRef.current = getRoadLayerIds(map)

      map.addSource(INTERVENTION_SOURCE_ID, {
        type: 'geojson',
        data: createFeatureCollection([]),
      })

      map.addSource(DROP_PREVIEW_SOURCE_ID, {
        type: 'geojson',
        data: createFeatureCollection([]),
      })

      map.addLayer({
        id: 'planned-bike-lanes',
        type: 'line',
        source: INTERVENTION_SOURCE_ID,
        filter: ['==', ['get', 'interventionType'], 'bike-lane'],
        paint: {
          'line-color': '#22c55e',
          'line-width': 8,
          'line-opacity': 0.85,
        },
      })

      map.addLayer({
        id: 'planned-crosswalks-outline',
        type: 'line',
        source: INTERVENTION_SOURCE_ID,
        filter: ['==', ['get', 'interventionType'], 'crosswalk'],
        paint: {
          'line-color': '#0f172a',
          'line-width': 10,
          'line-opacity': 0.9,
        },
      })

      map.addLayer({
        id: 'planned-crosswalks',
        type: 'line',
        source: INTERVENTION_SOURCE_ID,
        filter: ['==', ['get', 'interventionType'], 'crosswalk'],
        paint: {
          'line-color': '#f8fafc',
          'line-width': 6,
          'line-dasharray': [0.8, 0.8],
        },
      })

      map.addLayer({
        id: 'drop-preview-line',
        type: 'line',
        source: DROP_PREVIEW_SOURCE_ID,
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'isValid'], 'true'],
            '#38bdf8',
            '#fb7185',
          ],
          'line-width': 10,
          'line-opacity': 0.95,
        },
      })

      map.addLayer({
        id: 'drop-preview-line-core',
        type: 'line',
        source: DROP_PREVIEW_SOURCE_ID,
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'isValid'], 'true'],
            '#f8fafc',
            '#fff1f2',
          ],
          'line-width': 4,
          'line-opacity': 0.95,
        },
      })

      setIsMapReady(true)
      setStatusMessage('Map ready. Drag a bike lane or crosswalk card onto a road.')
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [accessToken])

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return
    }

    const source = mapRef.current.getSource(INTERVENTION_SOURCE_ID)

    if (source) {
      source.setData(createFeatureCollection(interventions))
    }
  }, [interventions, isMapReady])

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return
    }

    const source = mapRef.current.getSource(DROP_PREVIEW_SOURCE_ID)

    if (source) {
      source.setData(previewFeatureCollection)
    }
  }, [previewFeatureCollection, isMapReady])

  function getRoadFeatureAtClientPoint(clientX, clientY) {
    const map = mapRef.current
    const mapContainer = mapContainerRef.current

    if (!map || !mapContainer || !isMapReady) {
      return { point: null, roadFeature: null }
    }

    const rect = mapContainer.getBoundingClientRect()
    const point = [clientX - rect.left, clientY - rect.top]

    if (point[0] < 0 || point[1] < 0 || point[0] > rect.width || point[1] > rect.height) {
      return { point, roadFeature: null }
    }

    const roadFeatures = map.queryRenderedFeatures(point, {
      layers: roadLayerIdsRef.current,
    })
    const roadFeature = roadFeatures.find((feature) =>
      ['LineString', 'MultiLineString'].includes(feature.geometry?.type),
    )

    return { point, roadFeature }
  }

  function updateDragPreview(toolId, clientX, clientY) {
    if (!toolId) {
      return
    }

    const { roadFeature } = getRoadFeatureAtClientPoint(clientX, clientY)

    if (!roadFeature) {
      setPreviewFeatureCollection(createFeatureCollection([]))
      setDropTargetState('idle')
      setStatusMessage(getPlacementRules(toolId, interventionCatalogById).emptyLabel)
      return
    }

    const placement = getRoadPlacementState(toolId, roadFeature, interventionCatalogById)
    setPreviewFeatureCollection(createPreviewFeature(roadFeature, toolId, placement.isValid))
    setDropTargetState(placement.isValid ? 'valid' : 'invalid')
    setStatusMessage(placement.message)
  }

  function addIntervention(toolId, clientX, clientY) {
    const map = mapRef.current

    if (!map || !isMapReady) {
      return
    }

    const { point, roadFeature } = getRoadFeatureAtClientPoint(clientX, clientY)

    if (!point || !roadFeature) {
      setStatusMessage('Drop the intervention directly onto the visible map area.')
      return
    }

    const placement = getRoadPlacementState(toolId, roadFeature, interventionCatalogById)

    if (!placement.isValid) {
      setStatusMessage(placement.message)
      return
    }

    const lngLat = map.unproject(point)
    const feature = createInterventionFeature(
      toolId,
      roadFeature,
      [lngLat.lng, lngLat.lat],
      `${toolId}-${Date.now()}`,
    )

    if (!feature) {
      setStatusMessage('That road segment could not be converted into a planned intervention.')
      return
    }

    setInterventions((currentFeatures) => [...currentFeatures, feature])
    setStatusMessage(
      toolId === 'bike-lane'
        ? 'Added a planned bike lane to that road segment.'
        : 'Added a planned crosswalk on that road.',
    )
  }

  function handleDragStart(event, toolId) {
    event.dataTransfer.setData('text/plain', toolId)
    event.dataTransfer.effectAllowed = 'copy'
    setDraggingToolId(toolId)
    setDropTargetState('idle')
    setPreviewFeatureCollection(createFeatureCollection([]))
    setStatusMessage(getPlacementRules(toolId, interventionCatalogById).emptyLabel)
  }

  function handleDrop(event) {
    event.preventDefault()
    const toolId = event.dataTransfer.getData('text/plain')

    if (!toolId) {
      return
    }

    addIntervention(toolId, event.clientX, event.clientY)
    setDraggingToolId(null)
    setDropTargetState('idle')
    setPreviewFeatureCollection(createFeatureCollection([]))
  }

  function clearPlan() {
    setInterventions([])
    setStatusMessage('Cleared the map. Drag a bike lane or crosswalk onto a road to add one.')
  }

  function handleMapDragOver(event) {
    event.preventDefault()

    const toolId = event.dataTransfer.getData('text/plain') || draggingToolId

    if (!toolId) {
      return
    }

    event.dataTransfer.dropEffect = 'copy'
    updateDragPreview(toolId, event.clientX, event.clientY)
  }

  function handleDragLeave() {
    setDropTargetState('idle')
    setPreviewFeatureCollection(createFeatureCollection([]))

    if (draggingToolId) {
      setStatusMessage(getPlacementRules(draggingToolId, interventionCatalogById).emptyLabel)
    }
  }

  function handleDragEnd() {
    setDraggingToolId(null)
    setDropTargetState('idle')
    setPreviewFeatureCollection(createFeatureCollection([]))
    setStatusMessage('Drag a bike lane or crosswalk card onto a road to start planning.')
  }

  return (
    <main className="app-shell">
      <section className="info-panel">
        <span className="eyebrow">City Decision Layer</span>
        <h1>Plan street safety interventions</h1>
        <p className="lead">
          This frontend prototype lets you drag a proposed bike lane or crosswalk
          directly onto the map so you can start building an intervention workflow
          before adding analysis or backend logic.
        </p>

        <div className="status-card">
          <h2>Map status</h2>
          {accessToken ? (
            <p>
              Access token detected. The map is centered on Austin so you can test
              corridors like South Congress right away.
            </p>
          ) : (
            <p>
              Add your Mapbox token to <code>frontend/.env.local</code> using
              <code>VITE_MAPBOX_ACCESS_TOKEN=your_token_here</code>, then restart
              the dev server.
            </p>
          )}
          <p className="status-pill">{isMapReady ? 'Map ready' : 'Waiting for map'}</p>
        </div>

        <div className="status-card">
          <h2>Drag interventions</h2>
          {catalogStatus === 'loading' ? (
            <p>Loading intervention catalog from the backend...</p>
          ) : catalogStatus === 'error' ? (
            <p>{catalogError}</p>
          ) : (
            <div className="tool-list">
              {interventionCatalog.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  draggable
                  className={`tool-card ${draggingToolId === tool.id ? 'dragging' : ''}`}
                  onDragStart={(event) => handleDragStart(event, tool.id)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="tool-card-title">{tool.label}</span>
                  <span className="tool-card-description">{tool.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="status-card">
          <h2>Current plan</h2>
          <div className="summary-row">
            <span>{interventionSummary.bikeLanes} bike lanes</span>
            <span>{interventionSummary.crosswalks} crosswalks</span>
          </div>
          <p className="status-text">{statusMessage}</p>
          <button type="button" className="clear-button" onClick={clearPlan}>
            Clear plan
          </button>
        </div>

        <div className="status-card">
          <h2>Architecture</h2>
          <p>
            Intervention definitions now live in the backend catalog, so the frontend
            reads the same labels and placement rules that your future analysis APIs
            can use.
          </p>
        </div>
      </section>

      <section
        className={`map-panel ${draggingToolId ? 'map-panel-dragging' : ''} ${
          dropTargetState === 'valid'
            ? 'map-panel-valid'
            : dropTargetState === 'invalid'
              ? 'map-panel-invalid'
              : ''
        }`}
        aria-label="Map preview"
        onDragOver={handleMapDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {accessToken ? (
          <>
            <div ref={mapContainerRef} className="map-container" />
            <div className="map-hint">
              {draggingToolId === 'crosswalk'
                ? 'Crosswalks only snap to local streets. Highways and major roads are blocked.'
                : draggingToolId === 'bike-lane'
                  ? 'Bike lanes can be dropped on eligible surface streets.'
                  : catalogStatus === 'error'
                    ? 'Start the backend to load intervention definitions for the planner.'
                    : 'Drop a bike lane or crosswalk card onto a road to add it to the plan.'}
            </div>
          </>
        ) : (
          <div className="map-placeholder">
            <p>Mapbox token needed before the map can load.</p>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
