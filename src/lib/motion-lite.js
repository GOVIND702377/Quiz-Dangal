import React from 'react';

let motionModulePromise = null;
let motionModule = null;

function loadMotionModule() {
  if (!motionModulePromise) {
    motionModulePromise = import('framer-motion')
      .then((mod) => {
        motionModule = mod;
        return mod;
      })
      .catch((err) => {
        motionModulePromise = null;
        if (import.meta.env?.DEV) {
          console.warn('framer-motion failed to load lazily', err);
        }
        throw err;
      });
  }
  return motionModulePromise;
}

const MOTION_ONLY_PROPS = new Set([
  'animate',
  'initial',
  'exit',
  'transition',
  'variants',
  'whileHover',
  'whileTap',
  'whileInView',
  'viewport',
  'layout',
  'layoutId',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'onAnimationStart',
  'onAnimationComplete',
  'custom',
  'style', // keep style separately so we can reapply after stripping
]);

function stripMotionProps(props) {
  if (!props) return props;
  const safe = {};
  for (const key of Object.keys(props)) {
    if (MOTION_ONLY_PROPS.has(key)) continue;
    safe[key] = props[key];
  }
  if (props && Object.prototype.hasOwnProperty.call(props, 'style')) {
    safe.style = props.style;
  }
  return safe;
}

function createMotionComponent(tag) {
  const MotionLiteComponent = React.forwardRef((props, ref) => {
    const [MotionComponent, setMotionComponent] = React.useState(() => motionModule?.motion?.[tag]);

    React.useEffect(() => {
      if (MotionComponent) return;
      let mounted = true;
      loadMotionModule()
        .then((mod) => {
          if (!mounted) return;
          if (mod?.motion?.[tag]) {
            setMotionComponent(() => mod.motion[tag]);
          }
        })
        .catch(() => {
          // ignore; fallback div already rendered
        });
      return () => {
        mounted = false;
      };
    }, [MotionComponent]);

    if (MotionComponent) {
      return React.createElement(MotionComponent, { ...props, ref });
    }

    const safeProps = stripMotionProps(props);
    return React.createElement(tag, { ...safeProps, ref }, props?.children);
  });

  MotionLiteComponent.displayName = `MotionLite(${tag})`;
  return MotionLiteComponent;
}

export const m = new Proxy(
  {},
  {
    get(target, key) {
      if (typeof key !== 'string') return undefined;
      if (!target[key]) {
        target[key] = createMotionComponent(key);
      }
      return target[key];
    },
  },
);

export function AnimatePresence(props) {
  const { children, ...rest } = props || {};
  const [Component, setComponent] = React.useState(() => motionModule?.AnimatePresence);

  React.useEffect(() => {
    if (Component) return;
    let mounted = true;
    loadMotionModule()
      .then((mod) => {
        if (!mounted) return;
        if (mod?.AnimatePresence) {
          setComponent(() => mod.AnimatePresence);
        }
      })
      .catch(() => {
        // ignore, fallback fragment already rendered
      });
    return () => {
      mounted = false;
    };
  }, [Component]);

  if (Component) {
    return React.createElement(Component, { children, ...rest });
  }

  return React.createElement(React.Fragment, null, children);
}

export function warmMotion() {
  if (motionModule || motionModulePromise) return;
  const schedule = (cb) => {
    if (typeof window === 'undefined') return;
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(cb, { timeout: 1500 });
    } else {
      window.setTimeout(cb, 1200);
    }
  };
  schedule(() => {
    loadMotionModule().catch(() => {
      /* lazy load failed, safe to ignore */
    });
  });
}
