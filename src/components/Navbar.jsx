import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Navbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 h-10 flex items-center">
        <Link to="/" reloadDocument className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
            <span className="font-display text-white text-sm font-bold">M</span>
          </div>
          <span className="font-display text-[17px] font-semibold text-gradient-gold" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
            Mansión Deseo
          </span>
        </Link>
      </div>
    </motion.header>
  );
}
