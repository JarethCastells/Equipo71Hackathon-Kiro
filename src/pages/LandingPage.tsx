import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import HowItWorks from '../components/HowItWorks'
import CandidateFeed from '../components/CandidateFeed'
import ForCompanies from '../components/ForCompanies'
import Footer from '../components/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950 font-sans text-white">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <CandidateFeed />
        <ForCompanies />
      </main>
      <Footer />
    </div>
  )
}
