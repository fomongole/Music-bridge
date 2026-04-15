import { Router } from 'express'
import {
  getAllPlaylists,
  createPlaylist,
  updatePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist
} from '../services/playlistService'

const router = Router()

// GET / — list all playlists
router.get('/', (_req, res) => {
  res.json(getAllPlaylists())
})
 
// POST / — create a new playlist { name: string }
router.post('/', (req, res) => {
  const { name } = req.body as { name?: string }
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  res.status(201).json(createPlaylist(name))
})
 
// PUT /:id — rename or reorder { name?, trackIds? }
router.put('/:id', (req, res) => {
  const updated = updatePlaylist(req.params.id, req.body)
  if (!updated) {
    res.status(404).json({ error: 'Playlist not found' })
    return 
  }
  res.json(updated)
})
 
// POST /:id/tracks — add a track { trackId: string }
router.post('/:id/tracks', (req, res) => {
  const { trackId } = req.body as { trackId?: string }
  if (!trackId) {
    res.status(400).json({ error: 'trackId is required' })
    return 
  }
  const updated = addTrackToPlaylist(req.params.id, trackId)
  if (!updated) {
    res.status(404).json({ error: 'Playlist not found' })
    return 
  }
  res.json(updated)
})
 
// DELETE /:id/tracks/:trackId — remove a track
router.delete('/:id/tracks/:trackId', (req, res) => {
  const updated = removeTrackFromPlaylist(req.params.id, req.params.trackId)
  if (!updated) {
    res.status(404).json({ error: 'Playlist not found' })
    return 
  }
  res.json(updated)
})
 
// DELETE /:id — delete entire playlist
router.delete('/:id', (req, res) => {
  const deleted = deletePlaylist(req.params.id)
  if (!deleted) {
    res.status(404).json({ error: 'Playlist not found' })
    return 
  }
  res.status(204).send()
})

export default router