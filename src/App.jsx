import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Search from './pages/Search'
import ArtistPage from './pages/ArtistPage'
import AlbumPage from './pages/AlbumPage'
import ProfilePage from './pages/ProfilePage'
import ListsPage from './pages/ListsPage'
import ListDetailPage from './pages/ListDetailPage'
import WishlistPage from './pages/WishlistPage'
import PeoplePage from './pages/PeoplePage'
import EditProfilePage from './pages/EditProfilePage'
import Login from './pages/Login'
import Signup from './pages/Signup'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/buscar" element={<Search />} />
        <Route path="/artista/:spotifyId" element={<ArtistPage />} />
        <Route path="/album/:spotifyId" element={<AlbumPage />} />
        <Route
          path="/perfil/editar"
          element={
            <ProtectedRoute>
              <EditProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/perfil/:username" element={<ProfilePage />} />
        <Route path="/lista/:listId" element={<ListDetailPage />} />
        <Route
          path="/listas"
          element={
            <ProtectedRoute>
              <ListsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/desejos"
          element={
            <ProtectedRoute>
              <WishlistPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pessoas"
          element={
            <ProtectedRoute>
              <PeoplePage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Signup />} />
      </Route>
    </Routes>
  )
}