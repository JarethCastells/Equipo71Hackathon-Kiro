import { useEffect, useRef, useState, type FormEvent } from 'react'
import {

  AlertCircle,
  Camera,
  Check,
  FileText,
  Globe,
  Image as ImageIcon,
  Link as LinkIcon,
  Newspaper,
  Phone,
  Plus,
  Share2,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  addPlatform,
  ApiError,
  createPost,
  deletePhoto,
  deletePost,
  listPlatforms,
  listPhotos,
  listPosts,
  removePlatform,
  updateMessageNotificationSettings,
  updateProfile,
  uploadAvatar,
  uploadCv,
  uploadPhoto,
  type UserPhoto,
  type UserPlatform,
  type UserPost,
} from '../../lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function ProfileSection() {
  const { user, refreshUser } = useAuth()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const cvInputRef = useRef<HTMLInputElement>(null)

  // Datos Básicos
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [phone, setPhone] = useState(user?.phoneNumber ?? '')

  const [savingBasic, setSavingBasic] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [basicMessage, setBasicMessage] = useState<string | null>(null)
  const [basicError, setBasicError] = useState<string | null>(null)

  // Redes Sociales / Plataformas
  const [platforms, setPlatforms] = useState<UserPlatform[]>([])
  const [newPlatformName, setNewPlatformName] = useState('LinkedIn')
  const [newPlatformUrl, setNewPlatformUrl] = useState('')
  const [addingPlatform, setAddingPlatform] = useState(false)

  // Galería de Fotos
  const [photos, setPhotos] = useState<UserPhoto[]>([])
  const [photoCaption, setPhotoCaption] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Mini-Blog de Publicaciones
  const [posts, setPosts] = useState<UserPost[]>([])
  const [postTitle, setPostTitle] = useState('')
  const [postContent, setPostContent] = useState('')
  const [postImageUrl, setPostImageUrl] = useState('')
  const [publishingPost, setPublishingPost] = useState(false)

  // CV
  const [uploadingCv, setUploadingCv] = useState(false)
  const [cvMessage, setCvMessage] = useState<string | null>(null)

  useEffect(() => {
    loadShowcaseData()
  }, [])

  const loadShowcaseData = async () => {
    try {
      const [platRes, photoRes, postRes] = await Promise.all([
        listPlatforms(),
        listPhotos(),
        listPosts(),
      ])
      setPlatforms(platRes.platforms)
      setPhotos(photoRes.photos)
      setPosts(postRes.posts)
    } catch (err) {
      console.error('Error cargando elementos del showcase:', err)
    }
  }

  // Actualizar datos básicos y teléfono
  const handleSaveBasicInfo = async (e: FormEvent) => {
    e.preventDefault()
    setBasicError(null)
    setBasicMessage(null)
    setSavingBasic(true)
    try {
      await updateProfile({ name, bio })
      await updateMessageNotificationSettings({ phoneNumber: phone.trim() })
      await refreshUser()
      setBasicMessage('Perfil e información básica actualizados correctamente.')
    } catch (err) {
      setBasicError(err instanceof ApiError ? err.message : 'Error al actualizar perfil.')
    } finally {
      setSavingBasic(false)
    }
  }

  // Subir Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBasicError(null)
    setUploadingAvatar(true)
    try {
      await uploadAvatar(file)
      await refreshUser()
      setBasicMessage('Foto de perfil actualizada.')
    } catch (err) {
      setBasicError(err instanceof ApiError ? err.message : 'No se pudo subir la foto de perfil.')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // Redes Sociales
  const handleAddPlatform = async (e: FormEvent) => {
    e.preventDefault()
    if (!newPlatformUrl.trim()) return
    setAddingPlatform(true)
    try {
      const res = await addPlatform(newPlatformName, newPlatformUrl.trim())
      setPlatforms((prev) => [...prev, res.platform])
      setNewPlatformUrl('')
    } catch (err) {
      console.error('Error al agregar red social:', err)
    } finally {
      setAddingPlatform(false)
    }
  }

  const handleRemovePlatform = async (id: string) => {
    try {
      await removePlatform(id)
      setPlatforms((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('Error al eliminar red social:', err)
    }
  }

  // Subir Foto a la Galería
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const res = await uploadPhoto(file, photoCaption.trim() || undefined)
      setPhotos((prev) => [res.photo, ...prev])
      setPhotoCaption('')
    } catch (err) {
      console.error('Error al subir foto:', err)
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const handleDeletePhoto = async (id: string) => {
    try {
      await deletePhoto(id)
      setPhotos((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('Error al eliminar foto:', err)
    }
  }

  // Crear Entrada en Mini-Blog
  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault()
    if (!postTitle.trim() || !postContent.trim()) return
    setPublishingPost(true)
    try {
      const res = await createPost({
        title: postTitle.trim(),
        content: postContent.trim(),
        imageUrl: postImageUrl.trim() || undefined,
      })
      setPosts((prev) => [res.post, ...prev])
      setPostTitle('')
      setPostContent('')
      setPostImageUrl('')
    } catch (err) {
      console.error('Error al crear publicación:', err)
    } finally {
      setPublishingPost(false)
    }
  }

  const handleDeletePost = async (id: string) => {
    try {
      await deletePost(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('Error al eliminar publicación:', err)
    }
  }

  // Subir CV
  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCvMessage(null)
    setUploadingCv(true)
    try {
      await uploadCv(file)
      await refreshUser()
      setCvMessage('¡Tu CV se ha subido correctamente!')
    } catch (err) {
      console.error('Error al subir CV:', err)
    } finally {
      setUploadingCv(false)
      if (cvInputRef.current) cvInputRef.current.value = ''
    }
  }

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const avatarSrc = user?.avatarUrl ? `${API_URL}${user.avatarUrl}` : null

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* SECCIÓN 1: Foto de Perfil e Información Básica */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-accent-400">
          <User size={18} />
          <h2 className="text-xs font-semibold uppercase tracking-wider">Información básica</h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Tu nombre completo, número de celular de contacto y una breve descripción sobre ti.
        </p>

        {basicError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <AlertCircle size={15} className="shrink-0" />
            {basicError}
          </div>
        )}
        {basicMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
            <Check size={15} className="shrink-0" />
            {basicMessage}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-6 border-b border-white/10 pb-6">
          <div className="relative">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Foto de perfil"
                className="h-24 w-24 rounded-full object-cover border-2 border-accent-500/40 shadow-xl"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-2xl font-bold text-white shadow-xl">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl hover:scale-110 disabled:opacity-60 transition-transform"
            >
              <Camera size={16} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div>
            <h3 className="text-base font-bold text-white">{user?.name}</h3>
            <p className="text-xs text-slate-400 capitalize">{user?.role} · TalentFlow AI</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="mt-3 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
            >
              {uploadingAvatar ? 'Subiendo...' : 'Cambiar foto de perfil'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveBasicInfo} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-medium text-slate-300">
                Nombre completo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-xs text-white outline-none focus:border-accent-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-xs font-medium text-slate-300">
                Número de Celular / WhatsApp
              </label>
              <div className="relative">
                <input
                  id="phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+52 55 1234 5678"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 pl-9 pr-4 py-2.5 text-xs text-white outline-none focus:border-accent-500"
                />
                <Phone size={14} className="absolute left-3 top-3 text-slate-500" />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="bio" className="block text-xs font-medium text-slate-300">
                Descripción / Bio
              </label>
              <span className="text-[10px] text-slate-500">{bio.length}/500</span>
            </div>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Cuéntanos sobre tu experiencia, habilidades o lo que buscas..."
              className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
            />
          </div>

          <button
            type="submit"
            disabled={savingBasic}
            className="rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg disabled:opacity-60"
          >
            {savingBasic ? 'Guardando...' : 'Guardar cambios básicos'}
          </button>
        </form>
      </div>

      {/* SECCIÓN 2: Redes Sociales & Plataformas */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-violet-400">
          <Share2 size={18} />
          <h2 className="text-xs font-semibold uppercase tracking-wider">Redes Sociales & Enlaces</h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Conecta tus perfiles profesionales para que reclutadores o candidatos exploren tu trabajo.
        </p>

        <form onSubmit={handleAddPlatform} className="mt-4 flex flex-col sm:flex-row items-center gap-2">
          <select
            value={newPlatformName}
            onChange={(e) => setNewPlatformName(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
          >
            <option value="LinkedIn">LinkedIn</option>
            <option value="GitHub">GitHub</option>
            <option value="Instagram">Instagram</option>
            <option value="Twitter">Twitter / X</option>
            <option value="Sitio Web">Sitio Web / Portafolio</option>
            <option value="YouTube">YouTube</option>
            <option value="TikTok">TikTok</option>
            <option value="Behance">Behance</option>
          </select>

          <div className="relative flex-1 w-full">
            <input
              type="url"
              required
              value={newPlatformUrl}
              onChange={(e) => setNewPlatformUrl(e.target.value)}
              placeholder="https://linkedin.com/in/tu-perfil"
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-violet-500"
            />
            <LinkIcon size={14} className="absolute left-3 top-2.5 text-slate-500" />
          </div>

          <button
            type="submit"
            disabled={addingPlatform || !newPlatformUrl.trim()}
            className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            <Plus size={14} />
            Agregar
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {platforms.length === 0 && (
            <p className="text-xs text-slate-500 italic py-2">No has añadido enlaces a redes sociales aún.</p>
          )}

          {platforms.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-slate-200"
            >
              <Globe size={13} className="text-violet-400" />
              <span className="font-semibold">{p.platformName}:</span>
              <a href={p.url} target="_blank" rel="noreferrer" className="max-w-[150px] truncate text-slate-400 hover:text-white underline">
                {p.url}
              </a>
              <button
                type="button"
                onClick={() => handleRemovePlatform(p.id)}
                className="ml-1 text-slate-500 hover:text-rose-400"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 3: Galería de Fotos & Presentación */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-emerald-400">
          <ImageIcon size={18} />
          <h2 className="text-xs font-semibold uppercase tracking-wider">Galería de Fotos & Portafolio</h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Sube imágenes de tus proyectos, eventos, reconocimientos o trabajos para mostrarlos en tu perfil.
        </p>

        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={photoCaption}
            onChange={(e) => setPhotoCaption(e.target.value)}
            placeholder="Descripción corta de la foto (opcional)"
            className="flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-xs text-white outline-none focus:border-emerald-500"
          />

          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60 transition-all"
          >
            <Upload size={14} />
            {uploadingPhoto ? 'Subiendo...' : 'Subir Foto'}
          </button>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.length === 0 && (
            <div className="col-span-full py-8 text-center border border-dashed border-white/10 rounded-2xl">
              <ImageIcon size={24} className="mx-auto text-slate-600" />
              <p className="mt-2 text-xs text-slate-500">Aún no has subido fotos a tu galería.</p>
            </div>
          )}

          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
              <img src={`${API_URL}${p.photoUrl}`} alt={p.caption || 'Foto'} className="h-36 w-full object-cover" />
              {p.caption && (
                <div className="p-2 text-[10px] text-slate-300 truncate bg-slate-900/90">{p.caption}</div>
              )}
              <button
                type="button"
                onClick={() => handleDeletePhoto(p.id)}
                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-rose-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 4: Mini-Blog de Presentación */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-amber-400">
          <Newspaper size={18} />
          <h2 className="text-xs font-semibold uppercase tracking-wider">Mini-Blog de Presentación</h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Publica artículos cortos, novedades de proyectos o reflexiones profesionales en tu muro de presentación.
        </p>

        <form onSubmit={handleCreatePost} className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <input
            type="text"
            required
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
            placeholder="Título de la publicación (ej. Mi nuevo proyecto con React y Gemini AI)"
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-xs text-white outline-none focus:border-amber-500"
          />

          <textarea
            required
            rows={3}
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="Escribe el contenido de tu publicación..."
            className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-500"
          />

          <div className="flex items-center justify-between gap-3">
            <input
              type="url"
              value={postImageUrl}
              onChange={(e) => setPostImageUrl(e.target.value)}
              placeholder="URL de imagen adjunta (opcional)"
              className="flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-xs text-white outline-none focus:border-amber-500"
            />

            <button
              type="submit"
              disabled={publishingPost || !postTitle.trim() || !postContent.trim()}
              className="flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60 transition-all"
            >
              <Plus size={14} />
              {publishingPost ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </form>

        {/* Stream de Publicaciones */}
        <div className="mt-6 space-y-4">
          {posts.length === 0 && (
            <p className="text-center text-xs text-slate-500 py-6 border border-dashed border-white/10 rounded-2xl">
              Aún no tienes publicaciones en tu mini-blog.
            </p>
          )}

          {posts.map((post) => (
            <div key={post.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{post.title}</h4>
                  <span className="text-[10px] text-slate-500">
                    {new Date(post.createdAt).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePost(post.id)}
                  className="text-slate-500 hover:text-rose-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>

              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="mt-3 max-h-56 w-full rounded-xl object-cover border border-white/10"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 5: CV / Documento de Presentación */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-cyan-400">
          <FileText size={18} />
          <h2 className="text-xs font-semibold uppercase tracking-wider">Currículum Vitae (CV)</h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Sube tu CV actualizado en formato PDF para que los reclutadores puedan descargarlo directamente.
        </p>

        {cvMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            <Check size={14} />
            {cvMessage}
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
          {user?.cvUrl ? (
            <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-200">
              <FileText size={18} />
              <div>
                <p className="font-bold">CV Subido</p>
                <a
                  href={`${API_URL}${user.cvUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] underline hover:text-white"
                >
                  Ver / Descargar CV
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No has subido un CV aún.</p>
          )}

          <button
            type="button"
            onClick={() => cvInputRef.current?.click()}
            disabled={uploadingCv}
            className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-60 transition-all"
          >
            {uploadingCv ? 'Subiendo...' : user?.cvUrl ? 'Reemplazar CV (PDF)' : 'Subir CV (PDF)'}
          </button>

          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleCvUpload}
          />
        </div>
      </div>
    </div>
  )
}
