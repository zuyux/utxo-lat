import { Loader } from "@/components/loader"

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <Loader size="lg" label="Loading page" />
    </main>
  )
}
