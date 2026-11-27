// El avatar de Alicia: un núcleo de IA animado, solo con CSS y SVG. El tamaño lo da la clase que se le pase (--aiorb).
const STAR = 'M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z'
const Star = ({ className }) => <svg className={className} viewBox="0 0 24 24"><path d={STAR} /></svg>

/** `orbit` añade los anillos con partículas; `busy` lo acelera mientras la IA trabaja. */
export default function AiOrb({ className = '', orbit, busy }) {
  return (
    <span className={'aiorb ' + className + (busy ? ' busy' : '')} aria-hidden="true">
      <span className="aiorb-ball">
        <i className="aiorb-flow" />
        <i className="aiorb-plasma" />
        <i className="aiorb-glass" />
        <Star className="aiorb-star" />
        <Star className="aiorb-spark a" />
        <Star className="aiorb-spark b" />
      </span>
      {orbit && <><i className="aiorb-ring" /><i className="aiorb-ring two" /></>}
    </span>
  )
}
