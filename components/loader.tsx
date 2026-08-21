"use client"

import type React from "react"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import loaderJson from "@/public/loader.json"

interface LoaderProps {
  className?: string
  size?: "sm" | "md" | "lg"
  label?: string
}

interface LottieKeyframe {
  t: number
  s: number[]
}

interface LottieProperty<T> {
  a?: number
  k: T | LottieKeyframe[]
}

interface LottieShapePath {
  i: number[][]
  o: number[][]
  v: number[][]
  c: boolean
}

interface LottieShapeItem {
  ty: string
  nm?: string
  it?: LottieShapeItem[]
  ks?: LottieProperty<LottieShapePath>
  c?: LottieProperty<number[]>
  o?: LottieProperty<number>
  w?: LottieProperty<number>
  p?: LottieProperty<number[]>
  a?: LottieProperty<number[]>
  s?: LottieProperty<number[]>
  r?: LottieProperty<number>
}

interface LottieLayer {
  ks?: {
    p?: LottieProperty<number[]>
    a?: LottieProperty<number[]>
    s?: LottieProperty<number[]>
    r?: LottieProperty<number>
    o?: LottieProperty<number>
  }
  shapes?: LottieShapeItem[]
}

interface LoaderAsset {
  fr: number
  ip?: number
  op: number
  w: number
  h: number
  layers: LottieLayer[]
}

const sizeClasses = {
  sm: "size-4",
  md: "size-8",
  lg: "size-12",
}

const fallbackAsset: LoaderAsset = {
  fr: 30,
  ip: 0,
  op: 60,
  w: 25,
  h: 25,
  layers: [],
}

const loaderAsset = loaderJson as LoaderAsset

const toKeyframes = (property?: LottieProperty<number | number[]>) =>
  property?.a === 1 && Array.isArray(property.k) && typeof property.k[0] === "object"
    ? property.k as LottieKeyframe[]
    : null

const valueAt = (property: LottieProperty<number | number[]> | undefined, frame: number, fallback: number[]) => {
  if (!property) return fallback

  const keyframes = toKeyframes(property)
  if (!keyframes) {
    const value = property.k as number | number[]
    return Array.isArray(value) ? value : [value]
  }

  const first = keyframes[0]
  if (!first || frame <= first.t) return first?.s ?? fallback

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index]
    const next = keyframes[index + 1]
    if (frame > next.t) continue

    const progress = (frame - current.t) / Math.max(1, next.t - current.t)
    return current.s.map((start, valueIndex) => {
      const end = next.s[valueIndex] ?? start
      return start + (end - start) * progress
    })
  }

  return keyframes[keyframes.length - 1]?.s ?? fallback
}

const transformAt = (item: LottieShapeItem, frame: number) => {
  const position = valueAt(item.p, frame, [0, 0])
  const anchor = valueAt(item.a, frame, [0, 0])
  const scale = valueAt(item.s, frame, [100, 100])
  const rotation = valueAt(item.r, frame, [0])[0] ?? 0

  return [
    `translate(${position[0] ?? 0} ${position[1] ?? 0})`,
    `rotate(${rotation})`,
    `scale(${(scale[0] ?? 100) / 100} ${(scale[1] ?? scale[0] ?? 100) / 100})`,
    `translate(${-(anchor[0] ?? 0)} ${-(anchor[1] ?? 0)})`,
  ].join(" ")
}

const pathData = (shape: LottieShapePath) => {
  const [first] = shape.v
  if (!first) return ""

  const commands = [`M ${first[0]} ${first[1]}`]
  for (let index = 1; index < shape.v.length; index += 1) {
    const previous = shape.v[index - 1]
    const point = shape.v[index]
    const outTangent = shape.o[index - 1] ?? [0, 0]
    const inTangent = shape.i[index] ?? [0, 0]

    commands.push(
      `C ${previous[0] + outTangent[0]} ${previous[1] + outTangent[1]} ` +
      `${point[0] + inTangent[0]} ${point[1] + inTangent[1]} ${point[0]} ${point[1]}`,
    )
  }

  if (shape.c) {
    const lastIndex = shape.v.length - 1
    const last = shape.v[lastIndex]
    const outTangent = shape.o[lastIndex] ?? [0, 0]
    const inTangent = shape.i[0] ?? [0, 0]
    commands.push(
      `C ${last[0] + outTangent[0]} ${last[1] + outTangent[1]} ` +
      `${first[0] + inTangent[0]} ${first[1] + inTangent[1]} ${first[0]} ${first[1]} Z`,
    )
  }

  return commands.join(" ")
}

const colorValue = (item?: LottieShapeItem) => {
  const color = item?.c?.k
  if (!Array.isArray(color)) return "currentColor"
  const [red = 1, green = 1, blue = 1, alpha = 1] = color as number[]
  return `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${alpha})`
}

const renderItems = (items: LottieShapeItem[] = [], frame: number, keyPrefix = "loader") => {
  const rendered: React.ReactNode[] = []

  items.forEach((item, index) => {
    const key = `${keyPrefix}-${index}-${item.ty}`

    if (item.ty === "gr") {
      const transform = item.it?.find((child) => child.ty === "tr")
      const children = item.it?.filter((child) => child.ty !== "tr") ?? []
      rendered.push(
        <g key={key} transform={transform ? transformAt(transform, frame) : undefined}>
          {renderItems(children, frame, key)}
        </g>,
      )
      return
    }

    if (item.ty === "sh" && item.ks?.k && !Array.isArray(item.ks.k)) {
      const stroke = items.find((sibling) => sibling.ty === "st")
      rendered.push(
        <path
          key={key}
          d={pathData(item.ks.k)}
          fill="none"
          stroke={colorValue(stroke)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={typeof stroke?.w?.k === "number" ? stroke.w.k : 1.5}
        />,
      )
    }
  })

  return rendered
}

export function Loader({ className, size = "md", label = "Loading" }: LoaderProps) {
  const [frame, setFrame] = useState(0)
  const asset = loaderAsset.layers.length > 0 ? loaderAsset : fallbackAsset

  useEffect(() => {
    if (asset.layers.length === 0) return

    let animationFrame = 0
    const startedAt = performance.now()
    const firstFrame = asset.ip ?? 0
    const totalFrames = Math.max(1, asset.op - firstFrame)

    const tick = (time: number) => {
      const elapsedSeconds = (time - startedAt) / 1000
      setFrame(firstFrame + ((elapsedSeconds * asset.fr) % totalFrames))
      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [asset])

  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-grid shrink-0 place-items-center text-primary", sizeClasses[size], className)}
    >
      <span className="sr-only">{label}</span>
      <svg
        aria-hidden="true"
        className="size-full"
        viewBox={`0 0 ${asset.w} ${asset.h}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {asset.layers.map((layer, index) => (
          <g
            key={`layer-${index}`}
            transform={layer.ks ? transformAt({ ty: "tr", ...layer.ks }, frame) : undefined}
          >
            {renderItems(layer.shapes, frame, `layer-${index}`)}
          </g>
        ))}
      </svg>
    </span>
  )
}
