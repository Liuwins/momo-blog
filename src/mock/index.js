import Mock from 'mockjs'

const Random = Mock.Random

const users = []
for (let i = 1; i <= 10; i++) {
  users.push({
    id: i,
    nickname: Random.cname(),
    avatar: `https://picsum.photos/seed/user${i}/100/100`,
    signature: Random.csentence(5, 20),
    postCount: Random.integer(0, 50),
    followerCount: Random.integer(0, 100),
    followingCount: Random.integer(0, 50)
  })
}

function generateComments(postId, count) {
  const comments = []
  for (let i = 0; i < count; i++) {
    const comment = {
      id: `${postId}_comment_${i}`,
      userId: Random.integer(1, 10),
      content: Random.csentence(5, 30),
      createdAt: Random.datetime(),
      replyTo: null
    }
    if (i > 0 && Random.boolean()) {
      const target = comments[Random.integer(0, i - 1)]
      comment.replyTo = {
        id: target.id,
        nickname: users.find(u => u.id === target.userId)?.nickname || '未知'
      }
    }
    comments.push(comment)
  }
  return comments
}

const posts = []
for (let i = 1; i <= 30; i++) {
  const imgCount = Random.pick([0, 1, 2, 3, 4, 6, 9])
  const images = []
  for (let j = 0; j < imgCount; j++) {
    images.push(`https://picsum.photos/seed/post${i}_${j}/400/400`)
  }
  const commentCount = Random.integer(0, 8)
  const likeUserIds = []
  const likeCount = Random.integer(0, 8)
  for (let j = 0; j < likeCount; j++) {
    const uid = Random.integer(1, 10)
    if (!likeUserIds.includes(uid)) likeUserIds.push(uid)
  }

  posts.push({
    id: i,
    userId: Random.integer(1, 10),
    content: Random.csentence(10, 100),
    images,
    createdAt: Random.datetime(),
    liked: Random.boolean(),
    likeCount: likeUserIds.length,
    likeUserIds,
    commentCount,
    _comments: generateComments(i, commentCount)
  })
}

function getUserForPost(post) {
  return users.find(u => u.id === post.userId) || users[0]
}

function decorateComment(c) {
  const u = users.find(u => u.id === c.userId)
  return {
    id: c.id,
    userId: c.userId,
    user: u ? { id: u.id, nickname: u.nickname, avatar: u.avatar } : null,
    content: c.content,
    createdAt: c.createdAt,
    replyTo: c.replyTo
  }
}

Mock.setup({ timeout: '200-600' })

Mock.mock(/\/api\/user\/login/, 'post', (options) => {
  const body = JSON.parse(options.body)
  if (body.phone && body.code) {
    return {
      code: 200,
      message: '登录成功',
      data: {
        token: 'mock_token_' + Random.guid(),
        user: { ...users[0] }
      }
    }
  }
  return { code: 400, message: '参数错误', data: null }
})

Mock.mock(/\/api\/user\/register/, 'post', () => {
  return {
    code: 200,
    message: '注册成功',
    data: {
      token: 'mock_token_' + Random.guid(),
      user: { ...users[0] }
    }
  }
})

Mock.mock(/\/api\/user\/\d+/, 'get', (options) => {
  const id = parseInt(options.url.match(/\/user\/(\d+)/)[1])
  const user = users.find(u => u.id === id) || users[0]
  return {
    code: 200,
    message: 'ok',
    data: { ...user }
  }
})

Mock.mock(/\/api\/user\/profile/, 'put', () => {
  return { code: 200, message: '更新成功', data: null }
})

Mock.mock(/\/api\/posts/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || 1)
  const pageSize = parseInt(url.searchParams.get('pageSize') || 10)
  const keyword = url.searchParams.get('keyword')
  let source = posts
  if (keyword) {
    source = posts.filter(p => (p.content || '').includes(keyword))
  }
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const list = source.slice(start, end).map(p => ({
    id: p.id,
    userId: p.userId,
    user: getUserForPost(p),
    content: p.content,
    images: p.images,
    createdAt: p.createdAt,
    liked: p.liked,
    likeCount: p.likeCount,
    likeUsers: p.likeUserIds.map(uid => {
      const u = users.find(uu => uu.id === uid)
      return u ? { id: u.id, nickname: u.nickname } : null
    }).filter(Boolean),
    commentCount: p.commentCount,
    comments: p._comments.slice(0, 3).map(decorateComment)
  }))
  return {
    code: 200,
    message: 'ok',
    data: { list, total: source.length }
  }
})

Mock.mock(/\/api\/posts\/\d+/, 'get', (options) => {
  const id = parseInt(options.url.match(/\/posts\/(\d+)/)[1])
  const post = posts.find(p => p.id === id)
  if (!post) {
    return { code: 404, message: '动态不存在', data: null }
  }
  return {
    code: 200,
    message: 'ok',
    data: {
      post: {
        id: post.id,
        userId: post.userId,
        user: getUserForPost(post),
        content: post.content,
        images: post.images,
        createdAt: post.createdAt,
        liked: post.liked,
        likeCount: post.likeCount,
        likeUsers: post.likeUserIds.map(uid => {
          const u = users.find(uu => uu.id === uid)
          return u ? { id: u.id, nickname: u.nickname } : null
        }).filter(Boolean),
        commentCount: post.commentCount,
        comments: post._comments.map(decorateComment)
      }
    }
  }
})

Mock.mock(/\/api\/posts/, 'post', (options) => {
  const body = JSON.parse(options.body)
  if (!body.content?.trim() && (!body.images || body.images.length === 0)) {
    return { code: 400, message: '内容或图片至少填写一项', data: null }
  }
  const newPost = {
    id: posts.length + 1,
    userId: 1,
    content: body.content,
    images: body.images || [],
    createdAt: new Date().toISOString(),
    liked: false,
    likeCount: 0,
    likeUserIds: [],
    commentCount: 0,
    _comments: []
  }
  posts.unshift(newPost)
  return {
    code: 200,
    message: '发布成功',
    data: {
      post: {
        ...newPost,
        user: { ...users[0] },
        likeUsers: [],
        comments: []
      }
    }
  }
})

Mock.mock(/\/api\/posts\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.match(/\/posts\/(\d+)/)[1])
  const body = JSON.parse(options.body)
  const post = posts.find(p => p.id === id)
  if (!post) {
    return { code: 404, message: '动态不存在', data: null }
  }
  post.content = body.content ?? post.content
  post.images = body.images ?? post.images
  return {
    code: 200,
    message: '更新成功',
    data: {
      post: {
        ...post,
        user: getUserForPost(post),
        likeUsers: post.likeUserIds.map(uid => {
          const u = users.find(uu => uu.id === uid)
          return u ? { id: u.id, nickname: u.nickname } : null
        }).filter(Boolean),
        comments: post._comments.map(decorateComment)
      }
    }
  }
})

Mock.mock(/\/api\/posts\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.match(/\/posts\/(\d+)/)[1])
  const index = posts.findIndex(p => p.id === id)
  if (index === -1) {
    return { code: 404, message: '动态不存在', data: null }
  }
  posts.splice(index, 1)
  return { code: 200, message: '删除成功', data: null }
})

Mock.mock(/\/api\/user\/\d+\/posts/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const userId = parseInt(options.url.match(/\/user\/(\d+)\/posts/)[1])
  const page = parseInt(url.searchParams.get('page') || 1)
  const pageSize = parseInt(url.searchParams.get('pageSize') || 10)
  const userPosts = posts.filter(p => p.userId === userId)
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const list = userPosts.slice(start, end).map(p => ({
    id: p.id,
    userId: p.userId,
    user: getUserForPost(p),
    content: p.content,
    images: p.images,
    createdAt: p.createdAt,
    liked: p.liked,
    likeCount: p.likeCount,
    likeUsers: p.likeUserIds.map(uid => {
      const u = users.find(uu => uu.id === uid)
      return u ? { id: u.id, nickname: u.nickname } : null
    }).filter(Boolean),
    commentCount: p.commentCount,
    comments: p._comments.slice(0, 3).map(decorateComment)
  }))
  return {
    code: 200,
    message: 'ok',
    data: { list, total: userPosts.length }
  }
})

Mock.mock(/\/api\/posts\/\d+\/like/, 'post', (options) => {
  const id = parseInt(options.url.match(/\/posts\/(\d+)\/like/)[1])
  const post = posts.find(p => p.id === id)
  if (!post) {
    return { code: 404, message: '动态不存在', data: null }
  }
  if (post.liked) {
    post.likeCount = Math.max(0, post.likeCount - 1)
    post.likeUserIds = post.likeUserIds.filter(uid => uid !== 1)
  } else {
    post.likeCount++
    if (!post.likeUserIds.includes(1)) post.likeUserIds.push(1)
  }
  post.liked = !post.liked
  return { code: 200, message: '操作成功', data: { liked: post.liked, likeCount: post.likeCount } }
})

Mock.mock(/\/api\/posts\/\d+\/comments/, 'get', (options) => {
  const id = parseInt(options.url.match(/\/posts\/(\d+)\/comments/)[1])
  const post = posts.find(p => p.id === id)
  if (!post) {
    return { code: 200, message: 'ok', data: { comments: [] } }
  }
  return {
    code: 200,
    message: 'ok',
    data: { comments: post._comments.map(decorateComment) }
  }
})

Mock.mock(/\/api\/comments/, 'post', (options) => {
  const body = JSON.parse(options.body)
  if (!body.content?.trim()) {
    return { code: 400, message: '评论内容不能为空', data: null }
  }
  const post = posts.find(p => p.id === body.postId)
  if (!post) {
    return { code: 404, message: '动态不存在', data: null }
  }
  const comment = {
    id: `${body.postId}_comment_${Date.now()}`,
    userId: 1,
    content: body.content,
    createdAt: new Date().toISOString(),
    replyTo: body.replyTo || null
  }
  if (post) {
    post._comments.push(comment)
    post.commentCount = post._comments.length
  }
  const u = users[0]
  return {
    code: 200,
    message: '评论成功',
    data: {
      comment: {
        id: comment.id,
        userId: 1,
        user: { id: u.id, nickname: u.nickname, avatar: u.avatar },
        content: comment.content,
        createdAt: comment.createdAt,
        replyTo: comment.replyTo
      }
    }
  }
})

Mock.mock(/\/api\/comments\/\d+/, 'delete', (options) => {
  const commentId = options.url.match(/\/comments\/(\d+)/)?.[1] || options.url.match(/\/comments\/(.+)/)?.[1]
  for (const post of posts) {
    const idx = post._comments.findIndex(c => c.id === commentId)
    if (idx !== -1) {
      post._comments.splice(idx, 1)
      post.commentCount = post._comments.length
      return { code: 200, message: '删除成功', data: null }
    }
  }
  return { code: 404, message: '评论不存在', data: null }
})
