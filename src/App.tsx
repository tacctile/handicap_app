import { FileUpload } from './components/FileUpload'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Horse Monster</h1>
      </header>
      <main className="p-6">
        <FileUpload />
      </main>
    </div>
  )
}

export default App
