import { motion } from 'framer-motion'

interface SquashHamburgerProps {
  open: boolean
}

export default function SquashHamburger({ open }: SquashHamburgerProps) {
  return (
    <div className="relative w-[18px] h-[12px] sm:w-[15px] sm:h-[10px]">
      <motion.span
        className="absolute left-0 w-full bg-white"
        style={{ height: '1.5px', top: 0 }}
        animate={
          open
            ? { rotate: 45, y: '5.25px' }
            : { rotate: 0, y: '0px' }
        }
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
      <motion.span
        className="absolute left-0 top-1/2 -translate-y-1/2 w-full bg-white"
        style={{ height: '1.5px' }}
        animate={
          open
            ? { opacity: 0, scaleX: 0 }
            : { opacity: 1, scaleX: 1 }
        }
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
      <motion.span
        className="absolute left-0 w-full bg-white"
        style={{ height: '1.5px', bottom: 0 }}
        animate={
          open
            ? { rotate: -45, y: '-5.25px' }
            : { rotate: 0, y: '0px' }
        }
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
    </div>
  )
}
