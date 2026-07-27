import { useState } from 'react'
import { Button } from '@repo/ui/Button'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <Button 
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </Button>
      </section>
    </>
  )
}

export default App
